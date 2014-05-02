
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
    }

};

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




