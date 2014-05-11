
var ness = require('./ness'),
    optimist = require('optimist'),
    prettyjson = require('prettyjson');

var argv = optimist.argv;

var functions = {

    name: function()
    {
        ness.getName(function(err, name)
        {
            err ? printError(err) : console.log(name);
        });
    },

    modules: function()
    {
        ness.getModules([], function(err, modules)
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
        ness.getModules('attendance', function(err, modules)
        {
            if(err)
            {
                printError(err);
                return;
            }

            var isFirst = true;

            for(var i = 0; i < modules.length; ++ i)
            {
                if (isFirst)
                    console.log();
                else
                    isFirst = false;

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
        ness.getStages({}, function(err, stages) {
            err ? printError(err) : printJson(stages);
        });
    },
    module: function() {
        ness.getStages({id: 156973, year: 2013, stage: 2}, function(err, stages) {
            err ? printError(err) : printJson(stages);
        });
    },
    coursework: function() {
        ness.getModules('coursework', function(err, modules) {
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

ness.user(argv.user);
ness.pass(argv.pass);

if(functions[argv._[0]] === undefined) {
    console.log("ness: '" + argv._[0] + "' is not a ness command. See 'ness --help'.");
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





