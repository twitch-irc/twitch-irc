# twitch-irc
[![Build Status](https://secure.travis-ci.org/Schmoopiie/twitch-irc.png?branch=master)](https://travis-ci.org/Schmoopiie/twitch-irc)

**This project includes**

![](http://i.imgur.com/7PMEvN5.png)
Twitch is a trademark or registered trademark of Twitch Interactive, Inc. in the U.S. and/or other countries. "Twitch-IRC" is not operated by, sponsored by, or affiliated with Twitch Interactive, Inc. in any way.

## Installing the library

Either add the library as a dependency in your ``package.json`` or install the library globally:

```bash
$ npm install -g twitch-irc
```

## Configuration

``options``:
- ``debug``: [_Boolean_] Show debug messages in the console. (Default is false)
- ``debugIgnore``: [_Array_] Ignore some events when debugging. (Default is empty)
- ``logging``: [_Boolean_] Logs the console to file. (Default is false)
- ``tc``: [_Integer_] Your TWITCHCLIENT number. (Default is 3)

``connection``:
- ``retries``: [_Integer_] Maximum retries when trying to connect to server. (Default is -1 for infinite)
- ``reconnect``: [_Boolean_] Reconnect to server when disconnected. (Default is true)
- ``preferredServer``: [_String_] Connect to the specified server instead. (Optional)
- ``preferredPort``: [_Integer_] Port of the preferred server.
- ``serverType``: [_String_] Connect to a random server type. Types are chat, events and groups. (Default is chat)

``identity``:
- ``username``: [_String_] Username of your bot. (Optional)
- ``passpord``: [_String_] OAuth password of your bot. Use http://twitchapps.com/tmi/ to generate one.

``channels``: [_Array_] List of channels to join when connected to server. (Default is empty)

## How it works

```javascript
var irc = require('twitch-irc');

// Calling a new client..
var client = new irc.client({
    options: {
        debug: true,
        debugIgnore: ['ping', 'chat', 'action'],
        logging: false,
        tc: 3
    },
    identity: {
        username: 'Username',
        password: 'oauth:your_oauth'
    },
    channels: ['list', 'of', 'channels']
});

// Connect the client to server..
client.connect();

// Your events..
client.addListener('chat', function (channel, user, message) {
    // Do your stuff.
    if (message.indexOf('!hello') === 0) {
        // Say something.
        client.say(channel, 'Hey '+user.username+'! How you doing? Kappa');
    }
});
```

## Events

This is what makes this library unique. Twitch-IRC allows you to listen to multiple events at the same time.

[Click here for the events documentation](https://github.com/Schmoopiie/twitch-irc/wiki/Events).

## Commands

You can use each and every Twitch commands.

[Click here for the commands documentation](https://github.com/Schmoopiie/twitch-irc/wiki/Commands).

## Database

Create collections and interact with them like any database management system.

[Click here for the database documentation](https://github.com/Schmoopiie/twitch-irc/wiki/Database).

## Contributing Guidelines

Please review the [guidelines for contributing](https://github.com/Schmoopiie/twitch-irc/wiki/Contributing) to this repository.

## License

The MIT License (MIT)

Copyright (c) 2014 Schmoopiie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
