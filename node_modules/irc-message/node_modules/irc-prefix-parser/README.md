# irc-prefix-parser
> Parse IRC message prefixes

## Installation

    npm install irc-prefix-parser

## Usage

The parser takes a string and returns an object with:

* `raw` - original prefix
* `isServer` - boolean indicating whether or not the prefix is a server. If `false`, the prefix is a user.
* `nick`, `user` and `host`

```js
var parse = require('irc-prefix-parser')

console.log(parse('foobar.freenode.net'))
/* {
 *   raw: 'foobar.freenode.net',
 *   isServer: true,
 *   nick: null
 *   user: null
 *   host: 'foobar.freenode.net'
 * }
 */

console.log(parse('jamie!weechat@127.0.0.1'))
/* {
 *   raw: 'jamie!weechat@127.0.0.1',
 *   isServer: false,
 *   nick: 'jamie',
 *   user: 'weechat',
 *   host: '127.0.0.1'
 * }
 */
```
