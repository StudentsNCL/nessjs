
var request = require('request'),
    cheerio = require('cheerio'),
    moment = require('moment'),
    errors = require('./errors'),
    _ = require('underscore');

var user, pass;

var moduleCache = {};

var cacheDetail = {
    title: false,
    attendance: false,
    coursework: false
};

function cacheModule(code)
{
    return moduleCache[code] || (moduleCache[code] = { code: code });
}

exports.user = function(_user)
{
    if(_user !== undefined)
        user = _user;
    else
        return user;
}

exports.pass = function(_pass)
{
    if(_pass !== undefined)
        pass = _pass;
    else
        return pass;
}

exports.getModules = function(detail, callback)
{
    if (!Array.isArray(detail))
        detail = [detail];

    detail.push('code', 'title');

    var numOperations = 0;

    if (detail.indexOf('coursework') !== -1 && !cacheDetail.coursework)
    {
        ++ numOperations;

        getPage('https://ness.ncl.ac.uk/php/summary.php', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }

            var module;

            $('#mainbody dl').first().children().each(function(i)
            {
                var $this = $(this);

                if(i % 2 == 0)
                {
                    var moduleLink = $this.find('a').first();
                    module = cacheModule(moduleLink.attr('title'));
                    module.title =  moduleLink.text().split(' - ')[1];
                    module.coursework =  [];
                }
                else
                {
                    $this.find('tbody').first().children('tr').each(function()
                    {
                        var tds = $(this).children('td');
                        var courseworkLink = $(tds[0]).find('a');
                        var coursework = {};

                        if(courseworkLink.length > 0)
                            coursework.url = courseworkLink.attr('href');
                        else
                            courseworkLink = $(tds[0]).find('span');

                        coursework.title = courseworkLink.text();

                        if(courseworkLink.attr('title') !== undefined)
                            coursework.due = moment(courseworkLink.attr('title'), 'HH:mm:ss , D MMM YYYY').format()

                        module.coursework.push(coursework);
                    });

                    /* var moduleSummary = $(this).find('table:eq(1) tr:first'); */
                }
            });

            cacheDetail.title = true;
            cacheDetail.coursework = true;

            operationComplete();
        });
    }

    if (detail.indexOf('attendance') !== -1 && !cacheDetail.attendance)
    {
        ++ numOperations;

        getPage('https://ness.ncl.ac.uk/auth/student/attendance.php', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }

            $('#mainbody tr').each(function ()
            {
                var moduleLink = $(this).find('th a');
                var attendanceDesc = $(this).find('td').text();

                var module = cacheModule(moduleLink.text());
                module.title = moduleLink.attr('title');

                _.extend(module, parseAttendance(attendanceDesc));
            });

            cacheDetail.title = true;
            cacheDetail.attendance = true;
            
            operationComplete();
        });
    }

    /* If none of the other detail is requested, we at least need the list of
     * modules.
     */
    if (numOperations == 0 && !cacheDetail.title)
    {
        ++ numOperations;

        getPage('https://ness.ncl.ac.uk', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }

            $('#topmenu li').each(function () {
                var module = cacheModule($(this).text());
                module.title = $(this).attr('title');
            });

            cacheDetail.title = true;

            operationComplete();
        });
    }

    function operationComplete()
    {
        if((-- numOperations) > 0)
        {
            /* Still got something to do
             */
            return;
        }

        /* Filter the modules from the cache to only include the requested detail
         */
        var modules = [];

        for(var code in moduleCache)
        {
            var module = {};

            for(var j = 0; j < detail.length; ++ j)
                module[detail[j]] = moduleCache[code][detail[j]];

            modules.push(module);
        }
        
        callback(null, modules);
    }

    if (numOperations == 0)
        operationComplete();
}

exports.getStages = function(callback)
{
    getPage('https://ness.ncl.ac.uk/student/summary/index.php', function(err, $)
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
            
            getPage('https://ness.ncl.ac.uk/student/summary/stageSummary.php?&reportyear='
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

                    var module = cacheModule($($td[0]).text().trim());

                    module.credits = parseInt($($td[1]).text().trim());
                    module.year = $($td[2]).text().trim();
                    module.attempt = $($td[3]).text().trim();
                    module.attemptMark = $($td[4]).text().trim();
                    module.finalMark = $($td[5]).text().trim();
                    module.decision = $($td[6]).text().trim();

                    _.extend(module, parseAttendance($($td[7]).text().trim()));
                    cacheDetail.attendance = true;

                    stage.modules.push(module);
                });
                
                if(stage.stage == stages.length - 1)
                    callback(null, stages);
            });
            
            stages.push(stage);
            offset = 0;
        });
    });
}

function getPage(url, callback)
{
    request({
      uri: url,
      auth: {
        user: user, pass: pass,
        sendImmediately: false
      }
    }, function (error, response, body)
    {
        if (!error && response.statusCode == 200)
            callback(null, cheerio.load(body));
        else
            callback(error, null);
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



