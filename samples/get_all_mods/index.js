/*
    Twitch doesn't send any information regarding the moderators unless
    you send the /mods command on a channel or retrieve the mods from the
    Twitch API (unofficial). Easiest way is to send the mods command and
    listen to the mods event to catch the result.

    In this example, we send the mods command when joining a channel.

    Documentation:
    https://github.com/Schmoopiie/twitch-irc/wiki/Command:-Mods
    https://github.com/Schmoopiie/twitch-irc/wiki/Event:-Mods
 */

var irc = require('twitch-irc');

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
    if (username === clientOptions.identity.username.toLowerCase()) {
        console.log('bot joined '+channel);

        // Sending the mods command to the channel..
        client.mods(channel);
    }
});

// Got the mods from a channel..
client.addListener('mods', function (channel, mods) {
    console.log('mods for '+ channel + ' are:');
    console.log(mods);
});