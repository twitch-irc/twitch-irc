# twitch-irc
[![Build Status](https://secure.travis-ci.org/Schmoopiie/twitch-irc.png?branch=master)](https://travis-ci.org/Schmoopiie/twitch-irc) [![Downloads](http://img.shields.io/npm/dm/twitch-irc.svg)](https://www.npmjs.org/package/twitch-irc) [![Npm Version](http://img.shields.io/npm/v/twitch-irc.svg)](https://www.npmjs.org/package/twitch-irc) [![Issues](http://img.shields.io/github/issues/schmoopiie/twitch-irc.svg)](https://github.com/Schmoopiie/twitch-irc/issues)

![](http://i.imgur.com/7PMEvN5.png)
Twitch is a trademark or registered trademark of Twitch Interactive, Inc. in the U.S. and/or other countries. "Twitch-IRC" is not operated by, sponsored by, or affiliated with Twitch Interactive, Inc. in any way.

## Installing the library

Add the library as a dependency in your ``package.json`` and type:

```bash
$ npm install
```

Or install the library locally:

```bash
$ npm install twitch-irc
```

Would like to use the [beta version](https://github.com/Schmoopiie/twitch-irc/tree/1.1.1b) ?

```bash
$ npm install twitch-irc@beta
```

## Configuration

**Note:** Some options are only available with the beta version.

``options``: (Optional)
- ``checkUpdates``: {Boolean} Check for updates. (Default is true)
- ``exitOnError``: {Boolean} Exit the application on error. (Default is true)
- ``database``: {String} Path to the database directory. (Default is './database')
- ``debug``: {Boolean} Show debug messages in the console. (Default is false)
- ``debugIgnore``: {Array} Ignore some events when debugging. (Default is empty)
- ``tc``: {Integer} Your TWITCHCLIENT number. (Default is 3)

``connection``: (Optional)
- ``retries``: {Integer} Maximum retries when trying to connect to server. (Default is infinite)
- ``reconnect``: {Boolean} Reconnect to server upon disconnection. (Default is true)
- ``preferredServer``: {String} Connect to the specified server instead. (Optional)
- ``preferredPort``: {Integer} Port of the preferred server. (Optional)
- ``serverType``: {String} Connect to a random server type. Types are chat, events and groups. (Default is 'chat')

``logging``: (Optional)
- ``enabled``: {Boolean} Enable logging. (Default is false)
- ``chat``: {Boolean} Log chat messages to file. (Default is false)
- ``rewrite``: {Boolean} Rewrite the file when starting your application. (Default is true)
- ``timestamp``: {Boolean} Show timestamp. (Default is true)

``identity``: (Optional)
- ``username``: {String} Username of your bot. (Optional)
- ``password``: {String} OAuth password of your bot. Use http://twitchapps.com/tmi/ to generate one. (Optional)

``channels``: {Array} List of channels to join when connected to server. (Optional, default is empty)

## How it works

**Javascript**
```javascript
var irc = require('twitch-irc');

// Calling a new client..
var client = new irc.client({
    options: {
        debug: true,
        debugIgnore: ['ping', 'chat', 'action'],
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

## Features

- [Database management system](https://github.com/Schmoopiie/twitch-irc/wiki/Database).
- [Functions to make your life easier](https://github.com/Schmoopiie/twitch-irc/wiki/Utils).
- Gracefully reconnects to server.
- Supports IRCv3 tags.
- [Supports all Twitch events](https://github.com/Schmoopiie/twitch-irc/wiki/Events).
- [Supports all Twitch commands](https://github.com/Schmoopiie/twitch-irc/wiki/Commands).
- [Supports all Twitch API endpoints and OAuth 2.0](https://github.com/Schmoopiie/twitch-irc/wiki/Twitch-API).

## Contributing Guidelines

Please review the [guidelines for contributing](https://github.com/Schmoopiie/twitch-irc/wiki/Contributing) to this repository.

## Support

You can contact me on Twitter [@Schmoopiie](https://twitter.com/Schmoopiie/) or [create an issue](https://github.com/Schmoopiie/twitch-irc/issues/new).

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
