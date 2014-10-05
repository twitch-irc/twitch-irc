# twitch-irc
[![Build Status](https://secure.travis-ci.org/Schmoopiie/twitch-irc.png?branch=master)](https://travis-ci.org/Schmoopiie/twitch-irc)

![](http://i.imgur.com/7PMEvN5.png)
Twitch is a trademark or registered trademark of Twitch Interactive, Inc. in the U.S. and/or other countries. "Twitch-IRC" is not operated by, sponsored by, or affiliated with Twitch Interactive, Inc. in any way.

## Generator

If you wish to save time developing your bot, you might want to check [generator-twitch-irc](https://github.com/Schmoopiie/generator-twitch-irc)!

## Installing the library

Either add the library as a dependency in your ``package.json`` or install the library globally:

```bash
$ npm install -g twitch-irc
```

## Configuration

``options``:
- ``debug``: {Boolean} Show debug messages in the console. (Default is false)
- ``debugIgnore``: {Array} Ignore some events when debugging.
- ``logging``: {Boolean} Logs the console to file. (Default is false)
- ``tc``: {Integer} Your TWITCHCLIENT number. (Default is 3)

``connection``:
- ``retries``: {Integer} Maximum retries when trying to connect to server.
- ``reconnect``: {Boolean} Reconnect to server upon disconnection.
- ``preferredServer``: {String} Connect to the specified server instead. (Optional)
- ``preferredPort``: {Integer} Port of the preferred server.
- ``serverType``: {String} Connect to a random server type. Types are chat, events and groups. (Default is chat)

``identity``:
- ``username``: {String} Username of your bot. (Optional)
- ``passpord``: {String} OAuth password of your bot. Use http://twitchapps.com/tmi/ to generate one.

``channels``: {Array} List of channels to join when connected to server.

## How it works

**Javascript**
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
    // If the message starts with !hello..
    if (message.indexOf('!hello') === 0) {
        // Say something
        // https://github.com/Schmoopiie/twitch-irc/wiki/Command:-Say
        client.say(channel, 'Hey '+user.username+'! How you doing? Kappa');
    }
});
```

**Coffeescript**
```coffeescript
irc = require("twitch-irc")

# Calling a new client..
client = new irc.client(
  options:
    debug: true
    debugIgnore: [
      "ping"
      "chat"
      "action"
    ]
    logging: false
    tc: 3

  identity:
    username: "Username"
    password: "oauth:your_oauth"

  channels: [
    "list"
    "of"
    "channels"
  ]
)

# Connect the client to server..
client.connect()

# Your events..
client.addListener "chat", (channel, user, message) ->
  
  # If the message starts with !hello..
  if message.indexOf("!hello") is 0
    # Say something
    # https://github.com/Schmoopiie/twitch-irc/wiki/Command:-Say
    client.say channel, "Hey " + user.username + "! How you doing? Kappa"
  return
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
