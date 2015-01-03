# twitch-irc
[![Build Status](https://secure.travis-ci.org/Schmoopiie/twitch-irc.png?branch=master)](https://travis-ci.org/Schmoopiie/twitch-irc) [![Downloads](http://img.shields.io/npm/dm/twitch-irc.svg?style=flat)](https://www.npmjs.org/package/twitch-irc) [![Npm Version](http://img.shields.io/npm/v/twitch-irc.svg?style=flat)](https://www.npmjs.org/package/twitch-irc) [![Issues](http://img.shields.io/github/issues/schmoopiie/twitch-irc.svg?style=flat)](https://github.com/Schmoopiie/twitch-irc/issues)

![](http://i.imgur.com/7PMEvN5.png)
Twitch is a trademark or registered trademark of Twitch Interactive, Inc. in the U.S. and/or other countries. "Twitch-IRC" is not operated by, sponsored by, or affiliated with Twitch Interactive, Inc. in any way.

## Install twitch-irc

Install twitch-irc globally to use CLI features:

```bash
$ npm install --global twitch-irc
```

While developing your application, why not using the [beta version](https://github.com/Schmoopiie/twitch-irc/tree/1.1.1b) of twitch-irc and [report any bugs](https://github.com/Schmoopiie/twitch-irc/issues/new) ?

```bash
$ npm install --global twitch-irc@beta
```

## Configuration

Each and every options listed below are optional.

**Notice:** Some options are only available with the beta version.

``options``: (_Optional_)
- ``checkUpdates``: _Boolean_ — Check for updates when starting your app. (Default: _true_)
- ``database``: _String_ — Path to the database directory. (Default: _'./database'_)
- ``debug``: _Boolean_ — Show debug messages in the console. (Default: _false_)
- ``debugIgnore``: _Array_ — Ignore events while in debug mode. (Default: _[]_)
- ``exitOnError``: _Boolean_ — Exit the application on error. (Default: _true_)
- ``tc``: _Integer_ — Your TWITCHCLIENT value. (Default: _3_)

``connection``: (_Optional_)
- ``preferredServer``: _String_ — Connect to this particular server. (_Optional_)
- ``preferredPort``: _Integer_ — Change the default port. (_Optional_)
- ``reconnect``: _Boolean_ — Reconnect to twitch when disconnected. (Default: _true_)
- ``retries``: _Integer_ — Maximum attempts to connect to server. (Default: _-1_)
- ``serverType``: _String_ — Change the server type. (Default: _'chat'_)

``logging``: (_Optional_)
- ``enabled``: _Boolean_ — Enable logging to file. (Default: _false_)
- ``chat``: _Boolean_ — Enable logging of chat/action messages. (Default: _false_)
- ``rewrite``: _Boolean_ — Rewrite the log file when starting your app. (Default: _true_)
- ``timestamp``: _Boolean_ — Show timestamp in your log file. (Default: _true_)

``identity``: (_Optional_)
- ``username``: _String_ — Username of your bot.
- ``password``: _String_ — [OAuth password](http://twitchapps.com/tmi/) of your bot.

``channels``: _Array_ — List of channels you would like to join when connected. (Default: _[]_)

## Example

```javascript
var irc = require('twitch-irc');

// Calling a new instance..
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

// Connect the client to the server..
client.connect();

// Your events are called like this..
client.addListener('chat', function (channel, user, message) {
    if (message.indexOf('!hello') === 0) {
        client.say(channel, 'Hey ' + user.username + '! How you doing? Kappa');
    }
});
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

Feel free to [create an issue](https://github.com/Schmoopiie/twitch-irc/issues/new). We are active on the development of twitch-irc and we respond to each and every issues. When submitting, please include your Node/NPM versions, your operating system and the log file or the error message. Please, do your best to explain how to reproduce the issue.

## License

The MIT License (MIT)

Copyright (c) 2015 Schmoopiie

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