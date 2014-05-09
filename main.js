
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
                                + modules[i].numLecturesAttended
                                + '/'
                                + modules[i].numLecturesTotal
                                + ' lectures)');
                }
            }
        });
    },

    stages: function() {
        ness.getStages(user, function(err, stages) {
            err ? printError(err) : printJson(stages);
        });
    },
    coursework: function() {
        ness.getModules('coursework', user, function(err, modules) {
            err ? printError(err) : printJson(modules);
        });
    },
    feedback: function() {
        ness.getModules({feedback: 30488}, user, function(err, modules) {
            err ? printError(err) : printJson(modules);
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

user.id = argv.user;
user.pass = argv.pass;

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





