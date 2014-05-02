
var request = require('request'),
    optimist = require('optimist'),
    cheerio = require('cheerio');

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
            console.log(modules);
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
                    name: moduleLink.attr('title'),
                    numLecturesTotal: "N/A",
                    numLecturesAttended: "N/A",
                    attendance: "N/A"
                };

                if(attendanceDesc != "No Attendance Records")
                {
                    module.numLecturesTotal = parseInt(attendanceDesc
                        .split('(')[1] .split('/')[1]);

                    module.numLecturesAttended = parseInt(attendanceDesc
                        .split('(')[1] .split('/')[0]);

                    module.attendance = parseInt(attendanceDesc.split('%')[0]);
                }

                modules.push(module);

            });
            console.log(modules);
        });
    },
    assessment: function() {
        getPage('https://ness.ncl.ac.uk/student/summary/index.php', function($) {
            var modules = [];
            var offset = 1;
            $('tbody tr').each(function () {
                $td = $(this).find('td');
                var module = {
                    stage: parseInt($($td[0 + offset]).text().trim()),
                    year: $($td[1 + offset]).text().trim(),
                    credits: $($td[2 + offset]).text().trim(),
                    mark: $($td[3 + offset]).text().trim(),
                    decision: $($td[4 + offset]).text().trim()
                };
                if(module.credits != 'TBR') {
                    module.credits = parseInt(module.credits.substr(1));
                    module.mark = parseFloat(module.mark);
                }
                modules.push(module);
                offset = 0;
            });
            console.log(modules);
        });
    }
};

if(argv.help || !(argv.user && argv.pass)) {
    console.log('Usage: node ness.js --user b20XXXXXX --pass your_pass OPTION');
    console.log('Command-line interface for NESS');
    console.log('\nOPTION:');
    for (var f in functions)
        console.log('  ' + f);
    return;
}

functions[argv._[0]]();

function getPage(url, callback) {
    request.get(url, {
      'auth': {
        'user': argv.user,
        'pass': argv.pass,
        'sendImmediately': false
      }
    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        callback(cheerio.load(body));
      }
    })
}




