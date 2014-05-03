
var request = require('request'),
    optimist = require('optimist'),
    cheerio = require('cheerio'),
    prettyjson = require('prettyjson'),
    stringify = require('json-stringify-safe'),
    moment = require('moment'),
    errors = require('./errors');

function handleError(error, description, code) {
    printJson({
        error: {
            code: code || 500,
            error: error || errors[code] || 'errorGeneric',
            errorDescription: description
        }
    });
    return;
}

var argv = optimist.argv;

var functions = {
    modules: function() {
        getPage('https://ness.ncl.ac.uk', function($) {
            var modules = [];
            $('#topmenu li').each(function () {
                modules.push({
                    code: $(this).text(),
                    name: $(this).attr('title')
                });
            });
            printJson(modules);
        });
    },
             
    attendance: function() {
        getPage('https://ness.ncl.ac.uk/auth/student/attendance.php', function($) {
            var modules = [];
            $('#mainbody tr').each(function () {

                var moduleLink = $(this).find('th a');
                var attendanceDesc = $(this).find('td').text();

                var module = {
                    code: moduleLink.text(),
                    name: moduleLink.attr('title')
                };

                if(attendanceDesc != "No Attendance Records") {
                    module.numLecturesTotal = parseInt(attendanceDesc
                        .split('(')[1] .split('/')[1]);

                    module.numLecturesAttended = parseInt(attendanceDesc
                        .split('(')[1] .split('/')[0]);

                    module.attendance = parseInt(attendanceDesc.split('%')[0]);
                }

                modules.push(module);

            });
            printJson(modules);
        });
    },
    assessment: function() {
        getPage('https://ness.ncl.ac.uk/student/summary/index.php', function($) {
            var modules = [];
            var offset = 1;
            $('#mainbody tbody tr').each(function () {
                $td = $(this).find('td');
                var module = {
                    stage: parseInt($($td[0 + offset]).text().trim()),
                    year: $($td[1 + offset]).text().trim(),
                    decision: $($td[4 + offset]).text().trim()
                };
                var credits = $($td[2 + offset]).text().trim();
                if(credits != 'TBR')
                    module.credits = parseInt(credits.substr(1));
                var mark = $($td[3 + offset]).text().trim();
                if(mark != 'TBR')
                    module.mark = parseFloat(mark);
                modules.push(module);
                offset = 0;
            });
            printJson(modules);
        });
    },
    coursework: function() {
        getPage('https://ness.ncl.ac.uk/php/summary.php', function($) {
            var modules = [];
            var module;

            $('#mainbody dl').first().children().each(function(i) {
                var $this = $(this);
                if(i % 2 == 0) {
                    var moduleLink = $this.find('a').first();
                    module = {
                        code: moduleLink.attr('title'),
                        title: moduleLink.text().split(' - ')[1],
                        coursework: []
                    }
                } else {
                    $this.find('tbody').first().children('tr').each(function() {
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
                   

                    modules.push(module);
                }
            });

            printJson(modules);


        });
    }
};

if(argv.help || argv._[0] === undefined) {
    showHelp();
    return;
}

if(argv.user === undefined) {
    handleError("noUser", "Username required to login");
    return;
}

if(argv.pass === undefined) {
    handleError("noPass", "Password required to login");
    return;
}

if(functions[argv._[0]] === undefined) {
    console.log("ness: '" + argv._[0] + "' is not a ness command. See 'ness --help'.");
    return;
}

try{
    functions[argv._[0]]();
} catch(err) {
    handleError(err.message);
    return;
}
  
function getPage(url, callback) {
    request({
      uri: url,
      auth: {
        user: argv.user,
        pass: argv.pass,
        sendImmediately: false
      }
    }, function (error, response, body) {
        console.log(body);
      if (!error && response.statusCode == 200) {
        callback(cheerio.load(body));
      }
      else {
        handleError(null, "Unable to connect to NESS", response.statusCode);
      }
    });
}

function printJson(json) {
    console.log(argv.raw ? stringify(json, null, 3) : prettyjson.render(json));
}

function showHelp() {
    console.log('Usage: node ness --user b20XXXXXX --pass your_pass <OPTION>');
    console.log('Command-line interface for NESS');
    console.log('\nOPTION:');
    for (var f in functions)
        console.log('  ' + f);
}





