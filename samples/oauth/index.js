/**
 * Create a new application on Twitch: http://www.twitch.tv/kraken/oauth2/clients/new
 *
 * For this example:
 * Redirect URI: http://127.0.0.1:6511/auth/twitch/callback
 *
 * Change your clientID and clientSecret in your clientOptions.
 * Change your channels in your clientOptions.
 *
 * Launch the application and register your channel http://127.0.0.1:6511
 * Type !test in your channel and look at the console.
 */

var irc = require('twitch-irc');

var clientOptions = {
    options: {
        debug: true,
        debugIgnore: ['ping', 'chat', 'action'],
        tc: 3
    },
    oauth: {
        hostname: '127.0.0.1',
        port: 6511,
        clientID: '30bea55b94dffa98f8439631ce37ec00',
        clientSecret: 'f2a7e899b5af7365d70d252f3fd387dd',
        scopes: 'user_blocks_read'
    },
    channels: ['schmoopiie']
};

// Calling a new instance..
var client = new irc.client(clientOptions);

// Connect the client to the server..
client.connect();

// Listening to the chat event..
client.addListener('chat', function (channel, user, message) {
    if (message.toLowerCase().indexOf('!test') === 0) {
        client.api.twitch(
            channel,
            'GET',
            '/users/' + user.username + '/blocks',
            {
                limit: 5
            },
            function (error, statusCode, response) {
                if (error) {
                    console.log(error);
                    return;
                }
                console.log('Status code: ' + statusCode);
                console.log('Response from Twitch API:');
                console.log(JSON.stringify(response));
            }
        );
    }
});

// Listening to the oauth event..
client.addListener('oauth', function (result, username, token, scopes) {
    if (result) {
        console.log('Got your oauth token, ' + username + '!');
        console.log('Type !test in your channel to display the list of blocked users in your console.');
    }
});
