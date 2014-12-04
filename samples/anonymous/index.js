/*
    Ignoring the identity option will connect your bot as a random
    justinfan account. You will not be able to send messages and Twitch commands.
 */

var irc = require('twitch-irc');

// Calling a new client..
var client = new irc.client({
    options: {
        debug: true,
        debugIgnore: ['ping', 'chat', 'action'],
        logging: false,
        tc: 3
    },
    channels: ['schmoopiie']
});

// Connect the client to server..
client.connect();

// Your events..
client.addListener('chat', function (channel, user, message) {
    console.log(user.username+' > '+message);
});