
var request = require('request'),
    optimist = require('optimist'),
    cheerio = require('cheerio');

var argv = optimist.argv;

({ modules: function() {
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
                var attendance = $(this).find('td');
                modules.push({
                    code: moduleLink.text(),
                    name: moduleLink.attr('title'),
                    attendance: attendance.text()
                });
            });
            console.log(modules);
        });
    }

})[argv._[0]]();

function getPage(url, callback) {
    request.get(url, {
      'auth': {
        'user': argv.user,
        'pass': argv.pass,
        'sendImmediately': false
      }
    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
      console.log(body);
        callback(cheerio.load(body));
      }
    })
}




