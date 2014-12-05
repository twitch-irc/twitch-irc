/*
    Twitch doesn't send any information regarding the moderators unless
    you send the /mods command on a channel or retrieve the mods from the
    Twitch API (unofficial). Easiest way is to send the /mods command and
    listen to the mods event to catch the result.

    In this example, we send the /mods command when joining a channel and then
    store the result in the 'channels' object.

    Documentation:
    https://github.com/Schmoopiie/twitch-irc/wiki/Command:-Mods
    https://github.com/Schmoopiie/twitch-irc/wiki/Event:-Mods
 */

var irc = require('twitch-irc');

// Store all the channels and their mods in this object.
var channels = {};

var clientOptions = {
    options: {
        debug: true,
        debugIgnore: ['ping', 'chat', 'action'],
        logging: false,
        tc: 3,
        checkUpdates: false
    },
    identity: {
        username: 'Schmoobot',
        password: 'oauth:your_oauth_password'
    },
    channels: ['schmoopiie']
};

var client = new irc.client(clientOptions);

client.connect();

client.addListener('join', function (channel, username) {
    // Check if it's really the bot that is joining the channel..
    if (username === clientOptions.identity.username.toLowerCase()) {
        console.log('[!] Joined '+channel);

        // Send the /mods command..
        // Documentation: https://github.com/Schmoopiie/twitch-irc/wiki/Command:-Mods
        client.mods(channel);
    }
});

// Get the mods from a channel..
// Documentation: https://github.com/Schmoopiie/twitch-irc/wiki/Event:-Mods
client.addListener('mods', function (channel, mods) {
    console.log('[!] Got the mods of '+channel);

    // Update the channels object with the mods for that channel.
    channels[channel] = mods;
});

// How to check if username is a mod on a channel..
client.addListener('chat', function (channel, user, message) {
    // Make sure the channels object has the channel mods list..
    if (channels[channel]) {
        // If someone says !test on a channel..
        if (message.toLowerCase() === '!test') {
            // Show in the console the channels object..
            console.log(channels[channel]);
            // If the username is in the mods list for that channel..
            if (channels[channel].indexOf(user.username) >= 0) {
                client.say(channel, 'I see you as a mod.');
            } else {
                client.say(channel, 'You\'re not a mod.');
            }
        }
    }
});