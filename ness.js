
var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
var errors = require('./errors');
var _ = require('underscore');
var fs = require('fs');
var FormData = require('form-data');
var deprecate = require('depd')('nessjs');

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
                    var moduleLink = $this.find('a').first();
                    module = {
                        code: moduleLink.attr('title'),
                        title: moduleLink.text().split(' - ')[1],
                        coursework: []
                    };
                    module.did = $('#topmenu a:contains("' + module.code + '")').attr('href').match(/did=(\d+)/)[1];
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

                        if(courseworkLink.text() != "") {
                            coursework.title = courseworkLink.text();
                            coursework.safeTitle = makeSafe(coursework.title);
                        }

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
                            var date = $(tds[1]).text().match(/\d+:\d+:\d+ \w+, \d+[a-z]{2} \w+ \d+/);
                            if(date)
                                coursework.submitted = moment(date[0], 'HH:mm:ss DD MMM YYYY');
                        }

                        //check if class shows coursework is late or has been given an extension
                        if($(tds[1]).hasClass('llate') || $(tds[1]).hasClass('late'))
                            coursework.late = true;
                        else if($(tds[1]).hasClass('lextend') || $(tds[1]).hasClass('extend'))
                            coursework.extension = true;

                        //if general comments or feedback
                        if(tds.length > 2){
                            //if just feedback or just general comments
                            if(tds.length == 3){
                                if($(tds[2]).find('a').text() == 'General comments') {
                                    var f = $(tds[2]).find('a').attr('href');
                                    if (f)
                                      coursework.general = f.match(/\d+/)[0];
                                  }
                                else {
                                    var f = $(tds[2]).find('a').attr('href');
                                    if (f)
                                      coursework.feedback = f.match(/,\d+/)[0].substring(1);
                                  }
                            }
                            else{
                                coursework.general = $(tds[2]).find('a').attr('href').match(/\d+/)[0];
                                coursework.feedback = $(tds[3]).find('a').attr('href').match(/,\d+/)[0].substring(1);
                            }
                        }
                        if(coursework.title)
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

exports.getStages = function(detail, user, callback)
{
    //requesting specific module
    if(detail.id){
        getPage(user, 'https://ness.ncl.ac.uk/student/summary/moduleSummary.php?reportyear=' + detail.year + '&reportstage=' + detail.stage + '&componentid=' + detail.id, function(err, $)
            {
                if(err)
                {
                    callback(err, null);
                    return;
                }

                var work = {
                    code: $('#assessment-tree caption').text().trim().split(' ')[0],
                    exams: [],
                    coursework: []
                };

                var moduleName = getModuleName(work.code, $);
                    if (moduleName) {
                        work.name = moduleName;
                    }

                //contains current coursework until we find next assessment group
                var currentCoursework = {
                    coursework: []
                };

                //loop through every table row
                $('#assessment-tree tbody tr').each(function ()
                {
                    var tds = $(this).find('td');
                    var name = $(tds[0]).text().trim().split(' - ');
                    //if it is an exam
                    if($(this).find('.assessment-paper-row').length > 0) {
                        var exam = {
                            name: name[0],
                            percentage: name[1].substring(0, name[1].length - 1)
                        };

                        //if there is a mark then parse it to get details
                        var mark = $(tds[1]).text().trim();
                        if(mark != '')
                            exam.mark = mark.substring(0, mark.length - 1);

                        //if there is feedback then regex it to get stid and paperId
                        var feedback = $(tds[2]).find('a');
                        if(feedback.length > 0){
                            var url = $(feedback).attr('onclick').match(/\d+/g);
                            exam.feedback = {};
                            exam.feedback.stid = url[0];
                            exam.feedback.paperId = url[1];
                        }

                        work.exams.push(exam);
                    }
                    //if its a group of coursework
                    else if($(this).find('.assessment-exercisegroup-row').length > 0){
                        /*if we have finished an exercise group already then
                         *push it to the coursework array and reset it for next run
                        */
                        if(currentCoursework.name)
                            work.coursework.push(currentCoursework);
                        currentCoursework = {
                            name: name[0],
                            percentage: name[1].substring(0, name[1].length - 1),
                            coursework: []
                        };

                    }
                    //if its a piece of coursework
                    else if($(this).find('.assessment-exercise-row').length > 0){
                        var coursework = {
                            name: name[0],
                            percentage: name[1].substring(0, name[1].length - 1)
                        };

                        //if there is a mark then parse it to get details
                        var mark = $(tds[1]).text().trim();
                        if(mark != '' && mark != 'TBR'){
                            var marks = mark.match(/[\d\.]+/g);
                            coursework.mark = {
                                percent: marks[0],
                                mark: marks[1],
                                total: marks[2]
                            };
                        }

                        //if there is feedback read the url and set feedback to be exid
                        var feedback = $(tds[2]).find('a');
                        if(feedback.length > 0){
                            coursework.feedback = $(feedback).attr('onclick').match(/exid=([\d]+)/)[1];
                        }

                        //push coursework to temporary currentCoursework
                        currentCoursework.coursework.push(coursework);
                    }
                });

                //push last currentCoursework to coursework array before callback
                work.coursework.push(currentCoursework);
                callback(null, work);
            });
    }
    else {
        getPage(user, 'https://ness.ncl.ac.uk/student/summary/index.php', function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }

            var stages = [];
            var offset = 1;
            var count = $('#mainbody tbody tr').length;

            //each year
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

                    var totalAttempts = 0;
                    var attempt = 1;
                    var current_module = {};
                    // loop through rows (attempts on modules)
                    $('#mainbody tbody tr').each(function ()
                    {
                        var offset = 0;

                        $td = $(this).find('td');

                        // If there's there's no totalAttempts, we're on a new module
                        if (totalAttempts === 0) {
                            var height = $td.first().attr('rowspan');
                            totalAttempts = height ? height : 1;
                        }

                        // Need to offset row as not first attempt
                        if (totalAttempts > 1 && attempt > 1) {
                            offset = 3;
                        }
                        else {
                            // Cache module details ready for more attempts
                            current_module = {
                                code: $($td[0]).text().trim(),
                                credits: parseInt($($td[1]).text().trim()),
                                year: $($td[2]).text().trim(),
                                finalMark: $($td[5 - offset]).text().trim(),
                                decision: $($td[6 - offset]).text().trim(),
                            }
                            // Check if there is attendence column
                            if (($td.length + offset) === 9) {
                                current_module.attendance = parseAttendance($($td[7 - offset]).text().trim())
                            }
                            else {
                                current_module.attendance = null;
                            }
                        }

                        var module = {
                            code: current_module.code,
                            credits: current_module.credits,
                            year: current_module.year,
                            attempt: $($td[3 - offset]).text().trim(),
                            attemptMark: $($td[4 - offset]).text().trim(),
                            finalMark: current_module.finalMark,
                            decision: current_module.decision,
                            attendance: current_module.attendance,
                            id: $($td[$td.length - 1]).find('a').attr('href').split('componentid=')[1],
                        };

                        var moduleName = getModuleName(module.code, $);
                        if (moduleName) {
                            module.name = moduleName;
                        }

                        stage.modules.push(module);

                        if (attempt < totalAttempts) {
                            attempt++;
                        }
                        else {
                            attempt = 1;
                            totalAttempts = 0;
                        }
                    });

                    stages.push(stage);
                    // Sort stages by year
                    stages = _.sortBy(stages, function(s){ return s.year }).reverse();

                    if(stages.length == count)
                        callback(null, stages);

                });

                offset = 0;
            });
        });
    }
}

exports.getFeedback = function(detail, user, callback) {
    if (detail.personal || detail.general)
    {
        getPage(user, 'https://ness.ncl.ac.uk/auth/student/show' + (detail.personal?'com':'gen') + '.php?exid=' + (detail.personal || detail.general), function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var text = $('body');
            var marker = text.find('p.signature');
            var title = $('h3').text().split('"')[1];

            text.find('h3').remove();
            text.find('p.signature').remove();
            text.find('div').replaceWith(function() {
                return $('<p></p>').append($(this).contents());
            });
            text.find('br').remove();
            comment = {
                comment: text.html(),
                marker: marker.text(),
                title: title
            };

            callback(null, comment);
        });
    }

    else if (detail.paperId) {
        getPage(user, 'https://ness.ncl.ac.uk/student/summary/feedbackExam.php?stid=' + detail.stid + '&PaperId=' + detail.paperId, function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var text = $('.comment');

            comment = {
                title: $('h3').text().split('"')[1]
            };

            var individual = $(text[0]).html();
            if(individual != 'None')
                comment.individual = individual;
            var general = $(text[1]).html();
            if(general != 'None')
                comment.general = general;

            callback(null, comment);
        });
    }
    else if(detail.exid) {
        getPage(user, 'https://ness.ncl.ac.uk/student/summary/feedback.php?exid=' + detail.exid, function(err, $)
        {
            if(err)
            {
                callback(err, null);
                return;
            }
            var text = $('.leftc');

            comment = {
                title: $('h3').text().split('"')[1]
            };

            var individual = $(text[0]).html();
            if(individual != 'None')
                comment.individual = individual;
            var general = $(text[1]).html();
            if(general != 'None')
                comment.general = general;

            callback(null, comment);
        });
    }
}

exports.getUser = function(user, callback)
{
  getPage(user, 'https://ness.ncl.ac.uk', function(err, $)
    {
        if(err)
        {
            callback(err, null);
            return;
        }
        var u = $('#uname').text().trim().split(' (');
        var user = {
            id: u[1].slice(0,-1),
            name: u[0]
        };

        callback(null, user);
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

exports.getSubmit = function(coursework, user, callback)
{
    getPage(user, 'https://ness.ncl.ac.uk/?did=' + coursework.did, function(err, $) {
        if(err)
        {
            callback(err, null);
            return;
        }
        var found = false;
        $('#zcwk option').each(function() {
            // If this is the correct bit of coursework then use exid to get submission page
            if(makeSafe($(this).text()) == coursework.name) {
                found = true;
                var exid = $(this).val();
                getPage(user, 'https://ness.ncl.ac.uk/php/submit.php?exid=' + exid, function(err, $)
                {
                    if(err)
                    {
                        callback(err, null);
                        return;
                    }
                    if($('.error').length > 0) {
                        callback(null, {
                            error: $('.error').text(),
                            module: {
                                title: $('#topmenu li.active').attr('title'),
                                code: $('#topmenu li.active a').text()
                            },
                            coursework: $('#zcwk option[selected="selected"]').text()
                        });
                        return;
                    }
                    var mainbody = $('#mainbody');
                    var form = $('#sbmf');
                    var details = {
                        due: moment(mainbody.find('h3').text(), 'HH:mm:ss DD MMM YYYY'),
                        did: mainbody.find('input[name="did"]').val(),
                        exid: mainbody.find('input[name="exid"]').val(),
                        depid: mainbody.find('input[name="depid"]').val(),
                        uniq: mainbody.find('input[name="uniq"]').val(),
                        year: mainbody.find('input[name="year"]').val(),
                        files: form.find('input[type="file"]').length,
                        filesize: mainbody.find('input[name="MAX_FILE_SIZE"]').val(),
                        filetype: mainbody.find('p:not(.late):not(.warn)').eq(1).text().split(':')[1].trim(),
                        module: {
                            title: $('#topmenu li.active').attr('title'),
                            code: $('#topmenu li.active a').text()
                        },
                        coursework: $('#zcwk option[selected="selected"]').text()
                    };
                    if($('p.warn').length > 0) {
                        var submits = $('p.warn').text().match(/\d+/);
                        if(submits)
                            details.submits = submits[0];
                    }
                    callback(null, details);
                });
            }
        });
        // No coursework found
        if(!found){
            callback('No coursework found', null);
        }
    });
}

exports.submit = function(details, user, callback)
{
    if(!user.cookie) {
            callback({error: 401}, null);
        }
    else {
        var formData = {
            iid: '120',
            instid: '1',
            year: details.year,
            llevel: '1',
            did: details.did,
            exid: details.exid,
            depid: details.depid,
            debug: '',
            mask: '0',
            mode: '7',
            menu: '24',
            MAX_FILE_SIZE: details.filesize,
            uniq: details.uniq,
            xsno: user.fullid,
            grid: '',
            email: details.email || ''
          };
        for(var i = 0; i < details.files.length; i++) {
            formData['datafile[' + (i + 1) + ']'] = fs.createReadStream(details.dir + details.uniq + '/' + details.files[i]);
        }

        var headers = {
            'Cookie': user.cookie
        };
        var form = new FormData();
        for(var k in formData){
            form.append(k, formData[k]);
        }

        form.submit({
            port: 443,
            protocol: 'https:',
            host: 'ness.ncl.ac.uk',
            path: '/php/coursework.php',
            headers: headers
        }, function(err, res){
            if (err) {
                callback(err, null);
            }
            else {
                var body = '';
                res.on('data', function(chunk) {
                    body += chunk;
                });
                res.on('end', function() {
                    var $ = cheerio.load(body);
                    if($('.error').length > 0)
                        callback(null, { error: $('.error').text().trim() });
                    var result = {
                        files: [],
                        receipt: $('#mainbody p b').eq(1).text()
                    }
                    $('#mainbody table li').each(function() {
                        var data = $(this).html().trim().split('<br>');
                        var match = data[0].match(/([^\(]+)\(([^\)]+)\) - ([\d]+)/);//match(/([.]+) \(([.]+)\) - (\d+) /);

                        var file = {
                            name: match[1].trim(),
                            type: match[2],
                            size: match[3],
                            checksum: data[1].split(':')[1].trim()
                        }
                        result.files.push(file);
                    });
                    callback(null, result);
                });
            }
        });
    }
}

exports.login = function(user, callback)
{
    var jar = request.jar();
    var url = "https://ness.ncl.ac.uk";
    request.get({uri: url, jar: jar}, function(error, response, body) {
        if(error){
            return callback(error || {error: 401}, null);
        }
        request.post({url: 'https://gateway.ncl.ac.uk/idp/Authn/UserPassword', jar: jar, form:{j_username: user.id, j_password: user.pass, _eventId: 'submit', submit: 'LOGIN'}}, function (error, response, body) {
            if(error){
                return callback(error || {error: 401}, null);
            }
            request.get({url: url, jar: jar}, function (error, response, body) {
                if(error){
                    callback(error || {error: 401}, null);
                }
                var $ = cheerio.load(body);
                var $form = $('form');
                var action = $form.attr('action');
                var response = $form.find('input[name=SAMLResponse]').attr('value');
                request.post({url: action, jar: jar, form:{SAMLResponse: response}}, function (error, response, body) {
                    if(error){
                        callback(error || {error: 401}, null);
                    }
                    else{
                        var cookie = response.headers["set-cookie"][0];
                        request.get({url: url, jar: jar}, function (error, response, body) {
                            if(error){
                                callback(error || {error: 401}, null);
                            }
                            else {
                                var $ = cheerio.load(body);
                                var response = {
                                    name: $('#uname').text().trim().split(' (')[0],
                                    fullid: $('#uname').text().trim().split(' (')[1].slice(0,-1),
                                    cookie: cookie
                                }
                                callback(null, response);
                            }
                        });
                    }
                });
            });
        });
    });
}

function getPage(user, url, callback)
{
    if(user.dev) {
        var fs = require('fs');
        var filename = url.split('?')[0].substring(23).replace(/\//g, '-');
        var file = fs.readFileSync('testHTML/' + filename, 'utf8');
        var $ = cheerio.load(file);
        callback(null, $);
    }
    else {
        if(!user.cookie)
            callback({error: 401}, null);
        else {
            var headers = {
                'Cookie': user.cookie
            };
            request.get({
              url: url,
              headers: headers
            }, function (error, response, body)
            {
                if (!error && response.statusCode == 200 && body != '')
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
    }
}

function parseAttendance(attendanceDesc)
{
    if(attendanceDesc == "No Attendance Records" || attendanceDesc == "---")
        return {};

    var attendance = attendanceDesc.match(/(\d+).+\((\d+)\/(\d+)\)/);
    return {
        attendance: parseInt(attendance[1]),
        attended: parseInt(attendance[2]),
        total: parseInt(attendance[3])
    };
}

function makeSafe(string)
{
    var result = string.replace(/[^a-zA-Z0-9]/g,'-');
    // remove trailing dashes
    while(result.substr(-1) == '-') {
        result = result.substr(0, result.length - 1);
    }
    return result;
}

function getModuleName(code, $)
{
    var result;
    $('#topmenu li').each(function() {
        if ($(this).find('a').text() === code) {
            result = $(this).attr('title');
        }
    });
    return result;
}

/********* Deprecated functions **************/

exports.getName = deprecate.function(function(user, callback)
{
    exports.getUser(user, function(err, user){
        callback(null, user.name);
    });
}, 'getName(user, callback): Use getUser(user, callback) instead');
