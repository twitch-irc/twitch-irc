/**
 * Documentation is not available as this is only in beta and it may change at any time.
 */

var irc = require('twitch-irc');

var client = new irc.client({
    options: {
        debug: false,
        debugIgnore: ['ping', 'chat', 'action'],
        logging: false,
        tc: 3
    },
    channels: []
});

client.connect();

/**
 * Change the TWITCHCLIENT value using RAW message.
 */
client.addListener('connected', function () {
    client.raw('TWITCHCLIENT 1');
});

/**
 * Calling the Twitch API to get a list of chatters in a channel.
 */
client.api.chatters('schmoopiie').then(function (response) {
    console.log(response);
}, function (err) {
    console.log(err);
});

/**
 * Calling the Twitch API to get the badges of a channel.
 */
client.api.badges('schmoopiie').then(function (response) {
    console.log(response);
}, function (err) {
    console.log(err);
});

/**
 * Calling the Twitch API to get a channel object.
 */
client.api.channels('schmoopiie').then(function (response) {
    console.log(response);
}, function (err) {
    console.log(err);
});

/**
 * Cron job example.
 *
 * It starts after 3 seconds and then stop 10 seconds later.
 */
var cronJob = client.cron('* * * * * *', function() {
    console.log('You will see this message every second for 10 seconds.');
});

setTimeout(function(){
    cronJob.start();
}, 3000);

setTimeout(function(){
    cronJob.stop();
}, 13000);