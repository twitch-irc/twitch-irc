#!/usr/bin/env node

var async        = require('async');
var fs           = require('fs');
var inquirer     = require("inquirer");
var package      = require('../package.json');
var program      = require('commander');

program
    .version(package.version)
    .option('-i, --init', 'write the basic code for your bot', init);

program.on('--help', function(){
    console.log('  Wiki: https://github.com/Schmoopiie/twitch-irc/wiki');
});

program.parse(process.argv);

/**
 * Initialize a new project in the current directory.
 *
 * @param name
 */
function init() {
    fs.exists('./generator.json', function (exists) {
        if (!exists) {
            var questions = [
                {
                    type: 'input',
                    name: 'name',
                    message: 'what is the name of your project?'
                },
                {
                    type: "list",
                    name: "language",
                    message: "what language do you prefer?",
                    choices: [
                        "javascript",
                        "coffeescript"
                    ]
                },
                {
                    type: "list",
                    name: "login",
                    message: "does your bot needs to be logged in?",
                    choices: [
                        "yes",
                        "no"
                    ]
                },
                { when: function (response) {
                    if (response.login === 'yes') {
                        return true;
                    }
                    return false;
                },
                    type: 'input',
                    name: 'username',
                    message: 'what is the username of your bot?'
                },
                { when: function (response) {
                    return response.username;
                },
                    type: 'input',
                    name: 'oauth',
                    message: 'what is the oauth password of your bot?'
                },
                {
                    type: 'input',
                    name: 'channels',
                    message: 'what channels would you like to join?'
                }
            ];

            inquirer.prompt(questions, function (answers) {
                console.log(' ');
                console.log('  Processing...');

                async.series([
                        function(callback){
                            fs.mkdir('./node_modules', 0777, function(err) {
                                console.log('  created ./node_modules');
                                callback(err);
                            });
                        },
                        function(callback){
                            fs.writeFile('./generator.json', JSON.stringify(answers, null, 2), function (err) {
                                if (!err) { console.log('  created ./generator.json'); }
                                else { console.log('  error creating ./generator.json'); }
                                callback(err);
                            });
                        },
                        function(callback){
                            var filePackage = {
                                'name': answers.name,
                                'version': '0.0.1',
                                'description': 'Project description goes here.',
                                'dependencies': {}
                            };
                            fs.writeFile('./package.json', JSON.stringify(filePackage, null, 2), function (err) {
                                if (!err) { console.log('  created ./package.json'); }
                                else { console.log('  error creating ./package.json'); }
                                callback(err);
                            });
                        },
                        function(callback){
                            var username = 'justinfan' + Math.floor((Math.random() * 80000) + 1000);
                            var oauth    = 'SCHMOOPIIE';
                            var channels = [];

                            if (answers.login === 'yes') {
                                username = answers.username;
                                oauth    = answers.oauth.replace('oauth:', '');
                            }

                            if (oauth !== 'SCHMOOPIIE') { oauth = 'oauth:' + oauth; }

                            var separator = ' ';
                            if (answers.channels.indexOf(',') >= 0) { separator = ','; }

                            if (answers.channels.length >= 1) {
                                answers.channels.split(separator).map(function (value) {
                                    channels.push('\'' + value.replace('#', '').toLowerCase().trim() + '\'');
                                });
                            }

                            var content = '';
                            content += 'var irc = require(\'twitch-irc\');\n\n';
                            content += '// Calling a new instance..\n';
                            content += 'var client = new irc.client({\n';
                            content += '    options: {\n';
                            content += '        debug: true,\n';
                            content += '        debugIgnore: [\'ping\', \'chat\', \'action\'],\n';
                            content += '        tc: 3\n';
                            content += '    },\n';
                            if (oauth !== 'SCHMOOPIIE') {
                                content += '    identity: {\n';
                                content += '        username: \'' + username + '\',\n';
                                content += '        password: \'' + oauth + '\'\n';
                                content += '    },\n';
                            }
                            content += '    channels: ['+channels+']\n';
                            content += '});\n\n';
                            content += '// Connect the client to the server..\n';
                            content += 'client.connect();\n\n';
                            content += '// Documentation: https://github.com/Schmoopiie/twitch-irc/wiki/Event:-Chat\n';
                            content += 'client.addListener(\'chat\', function (channel, user, message) {\n';
                            content += '    if (message.toLowerCase().indexOf(\'!hello\') === 0) {\n';
                            if (answers.login === 'yes') {
                                content += '        client.say(channel, \'Hey \' + user.username + \'! How you doing? Kappa\');\n';
                            } else {
                                content += '        console.log(\'Wish I could say hi to \' + user.username + \' but I am not logged in :-(\');\n';
                            }
                            content += '    }\n';
                            content += '});\n';

                            fs.writeFile('./index.js', content, function (err) {
                                if (!err) { console.log('  created ./index.js'); }
                                else { console.log('  error creating ./index.js'); }
                                callback(err);
                            });
                        }
                    ],
                    function(err, results){
                        console.log(' ');
                        console.log('  Done!');
                    });
            });
        } else {
            console.log(' ');
            console.log('  There is already a project initialized in this directory.');
        }
    });
}