
var ness = require('./ness'),
    optimist = require('optimist'),
    prettyjson = require('prettyjson');

var argv = optimist.argv;

var user = {};

var functions = {

    name: function()
    {
        ness.getName(user, function(err, name)
        {
            err ? printError(err) : console.log(name);
        });
    },

    modules: function()
    {
        ness.getModules([], user, function(err, modules)
        {
            if(err)
            {
                printError(err);
                return;
            }

            for(var i = 0; i < modules.length; ++ i)
                console.log(modules[i].code + ': ' + modules[i].title);
        });
    },

    attendance: function()
    {
        ness.getModules('attendance', user, function(err, modules)
        {
            if(err)
            {
                printError(err);
                return;
            }

            for(var i = 0; i < modules.length; ++ i)
            {
                console.log();

                var module = modules[i];

                console.log(module.code + ': ' + module.title);

                if (module.attendance === undefined)
                {
                    console.log ('No attendance records');
                }
                else
                {
                    console.log(module.attendance
                                + '% attendance ('
                                + modules[i].attended
                                + '/'
                                + modules[i].total
                                + ' lectures)');
                }
            }
        });
    },

    stages: function() {
        ness.getStages({}, user, function(err, stages) {
            err ? printError(err) : printJson(stages);
        });
    },
    module: function() {
        ness.getStages({id: 156973, year: 2013, stage: 2}, user, function(err, stages) {
            err ? printError(err) : printJson(stages);
        });
    },
    coursework: function() {
        ness.getModules('coursework', user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    personalFeedback: function() {
        ness.getFeedback({personal: 30487}, user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    generalFeedback: function() {
        ness.getFeedback({general: 30303}, user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    examFeedback: function() {
        ness.getFeedback({paperId: 156975, stid: 169676}, user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    courseworkFeedback: function() {
        ness.getFeedback({exid: 30487}, user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    specification: function() {
        ness.getSpec('30489', user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    login: function() {
        ness.login(user, function(err, cookie) {
            user.cookie = cookie;
            ness.getStages({}, user, function(err, stages) {
                err ? printError(err) : printJson(stages);
            });
        });
    }
}

if(argv.help || argv._[0] === undefined) {
    showHelp();
    return;
}

//if developer mode
if(argv.dev)
    user.dev = argv.dev;
else{
    if(argv.user === undefined) {
        handleError("noUser", "Username required to login");
        return;
    }

    if(argv.pass === undefined) {
        handleError("noPass", "Password required to login");
        return;
    }

    user.id = argv.user;
    user.pass = argv.pass;
}

if(functions[argv._[0]] === undefined) {
    console.log("ness: '" + argv._[0] + "' is not a ness command. See 'main --help'.");
    return;
}

try{
    functions[argv._[0]]();
} catch(err) {
    printError(err);
    return;
}

function printError(error) {
    console.log(error);
}

function printJson(json) {
    console.log(argv.raw ? JSON.stringify(json, null, 3) : prettyjson.render(json));
}

function showHelp() {
    console.log('Usage: node ness --user b20XXXXXX --pass your_pass <OPTION>');
    console.log('Command-line interface for NESS');
    console.log('\nOPTION:');
    for (var f in functions)
        console.log('  ' + f);
}





