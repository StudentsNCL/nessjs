
var request = require('request'),
    cheerio = require('cheerio'),
    moment = require('moment'),
    errors = require('./errors'),
    _ = require('underscore');

var name;


exports.getModules = function(detail, user, callback)
{
    if (detail == 'coursework')
    {
        getPage(user, 'https://ness.ncl.ac.uk/php/summary.php', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }

            var modules = [];
        
            var module = {};
            $('#mainbody dl').first().children().each(function(i)
            {
                var $this = $(this);
                if(i % 2 == 0)
                {
                    module = {};
                    var moduleLink = $this.find('a').first();
                    module.code = moduleLink.attr('title');
                    module.title =  moduleLink.text().split(' - ')[1];
                    module.coursework = [];
                }
                else
                {
                    $this.find('tbody').first().children('tr').each(function()
                    {
                        var tds = $(this).children('td');
                        var courseworkLink = $(tds[0]).find('a');
                        var coursework = {};

                        //if there is a spec url
                        if(courseworkLink.length > 0){
                            var url = courseworkLink.attr('href');
                            //is ness url
                            if(url.charAt(0) == '/'){
                                url = 'https://ness.ncl.ac.uk' + url;
                                coursework.spec = url.match(/exid=\d+/)[0].split('=')[1];
                            }
                            coursework.url = url;
                        }
                        else
                            courseworkLink = $(tds[0]).find('span');

                        coursework.title = courseworkLink.text();

                        if(courseworkLink.attr('title') !== undefined)
                            coursework.due = moment(courseworkLink.attr('title'), 'HH:mm:ss , D MMM YYYY');
                        var courseworkMark = $(tds[1]).find('b').first();

                        if(courseworkMark.children('span').length > 0)
                            coursework.mark = {
                                    mark: courseworkMark.find('span').text(),
                                    total: courseworkMark.text().match(/\d+$/)[0]
                            };

                        var due = $(tds[1]).find('small');
                        //already submitted
                        if(due != ''){
                            $(tds[1]).find('b').remove();
                            $(tds[1]).find('small').remove();
                            var date = $(tds[1]).text().match(/\d+:\d+:\d+ \w+, \d+[a-z]{2} \w+ \d+/)[0];

                            coursework.submitted = moment(date, 'HH:mm:ss DD MMM YYYY');
                        }

                        //if general comments or feedback
                        if(tds.length > 2){
                            //if just feedback or just general comments
                            if(tds.length == 3){
                                if($(tds[2]).find('a').text() == 'General comments')
                                    coursework.general = $(tds[2]).find('a').attr('href').match(/\d+/)[0];
                                else
                                    coursework.feedback = $(tds[2]).find('a').attr('href').match(/,\d+/)[0].substring(1);
                            }
                            else{
                                coursework.general = $(tds[2]).find('a').attr('href').match(/\d+/)[0];
                                coursework.feedback = $(tds[3]).find('a').attr('href').match(/,\d+/)[0].substring(1);
                            }
                        }
                        module.coursework.push(coursework);
                    });

                    /* var moduleSummary = $(this).find('table:eq(1) tr:first'); */
                    
                    modules.push(module);
                }
            });
            
            callback(null, modules);
        });
    }

    else if (detail == 'attendance')
    {
        getPage(user, 'https://ness.ncl.ac.uk/auth/student/attendance.php', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var modules = [];
            $('#mainbody tr').each(function ()
            {
                var moduleLink = $(this).find('th a');
                var attendanceDesc = $(this).find('td').text();

                var module = {
                    code: moduleLink.text(),
                    title: moduleLink.attr('title')
                };

                _.extend(module, parseAttendance(attendanceDesc));
                
                modules.push(module);
            });
            callback(null, modules);
        });
    }
    else if (detail.feedback || detail.general)
    {
        getPage(user, 'https://ness.ncl.ac.uk/auth/student/show' + (detail.feedback?'com':'gen') + '.php?exid=' + (detail.feedback || detail.general), function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var text = $('.leftc');
            var marker = text.find('p.signature');
            text.find('p.signature').remove();
            text.find('div').replaceWith(function() {
                return $('<p></p>').append($(this).contents());
            });
            text.find('br').remove();

            comment = {
                comment: text.html(),
                marker: marker.text(),
                title: $('h3').text().split('"')[1]
            };
            callback(null, comment);
        });
    }

    /* If none of the other detail is requested, we at least need the module
     * titles.
     */
    else
    {
        getPage(user, 'https://ness.ncl.ac.uk', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var modules = [];
            $('#topmenu li').each(function () {
                var module = {
                    code: $(this).text(),
                    title: $(this).attr('title')
                };
                modules.push(module);
            });

            callback(null, modules);
        });
    }
}

exports.getStages = function(user, callback)
{
    getPage(user, 'https://ness.ncl.ac.uk/student/summary/index.php', function(err, $)
    {
        if(err)
        {
            callback(err, null);
            return;
        }

        var stages = [];
        var offset = 1;

        $('#mainbody tbody tr').each(function ()
        {
            $td = $(this).find('td');

            var stage = {
                stage: parseInt($($td[0 + offset]).text().trim()),
                year: $($td[1 + offset]).text().trim(),
                decision: $($td[4 + offset]).text().trim(),
                modules: []
            };

            var credits = $($td[2 + offset]).text().trim();

            if(credits != 'TBR')
                stage.credits = parseInt(credits.substr(1));

            var mark = $($td[3 + offset]).text().trim();

            if(mark != 'TBR')
                stage.mark = parseFloat(mark);
            
            getPage(user, 'https://ness.ncl.ac.uk/student/summary/stageSummary.php?&reportyear='
                        + stage.year + '&reportstage=' + stage.stage, function(err, $)
            {
                if(err)
                {
                    callback(err, null);
                    return;
                }

                var modules = [];

                $('#mainbody tbody tr').each(function ()
                {
                    $td = $(this).find('td');

                    var module = {
                            code: $($td[0]).text().trim(),
                            credits: parseInt($($td[1]).text().trim()),
                            year: $($td[2]).text().trim(),
                            attempt: $($td[3]).text().trim(),
                            attemptMark: $($td[4]).text().trim(),
                            finalMark: $($td[5]).text().trim(),
                            decision: $($td[6]).text().trim()
                        };

                    _.extend(module, parseAttendance($($td[7]).text().trim()));

                    stage.modules.push(module);
                });
                
                if(stage.stage == stages.length)
                    callback(null, stages);
            });
            
            stages.push(stage);
            offset = 0;
        });
    });
}

exports.getName = function(user, callback)
{
  getPage(user, 'https://ness.ncl.ac.uk', function(err, $)
    {
        if(err)
        {
            callback(err, null);
            return;
        }
        var name = $('#uname').text().trim().split(' (')[0]

        callback(null, name);
    });
}

exports.getSpec = function(exid, user, callback)
{
    getPage(user, 'https://ness.ncl.ac.uk/auth/info/showex.php?exid=' + exid, function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var mainbody = $('#mainbody');
            var trs = mainbody.find('tbody tr');
            var module = mainbody.find('h2').text().split(' - ');
            var specification = {
                module: {
                    code: module[0],
                    name: module[1]
                },
                title: mainbody.find('h3').text(),
                due: mainbody.find('h4').text(),
                mark: mainbody.find('p').first().text(),
                spec: $(trs[0]).find('td').html(),
                updated: moment($(trs[1]).text(), 'DD MMM YYYY HH:mm:ss')
            };
            callback(null, specification);
        });
}

function getPage(user, url, callback)
{
    request({
      uri: url,
      auth: {
        user: user.id, pass: user.pass,
        sendImmediately: false
      }
    }, function (error, response, body)
    {
        if (!error && response.statusCode == 200)
        {
            var $ = cheerio.load(body);

            callback(null, $);
        }
        else
        {
            callback(error || {error: 401}, null);
        }
    });
}

function parseAttendance(attendanceDesc)
{
    if(attendanceDesc == "No Attendance Records" || attendanceDesc == "---")
        return {};

    return {
        numLecturesTotal: parseInt(attendanceDesc.split('(')[1].split('/')[1]),
        numLecturesAttended: parseInt(attendanceDesc.split('(')[1].split('/')[0]),
        attendance: parseInt(attendanceDesc.split('%')[0])
    };
}



