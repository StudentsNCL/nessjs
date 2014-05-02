
var request = require('request'),
    optimist = require('optimist'),
    cheerio = require('cheerio');

var argv = optimist.argv;

request.get('https://ness.ncl.ac.uk', {
  'auth': {
    'user': argv.user,
    'pass': argv.pass,
    'sendImmediately': false
  }
}, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    subcommands[argv._[0]](cheerio.load(body));
  }
})

subcommands = {
    modules: function($) {
        var modules = [];
        $('#topmenu li').each(function (i, elem) {
            modules.push({
                code: $(this).text(),
                name: $(this).attr('title')
            });
        });
        console.log(modules);
    }
};




