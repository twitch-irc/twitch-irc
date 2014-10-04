# irc-message-stream [![Build Status](https://travis-ci.org/expr/irc-message-stream.png)](https://travis-ci.org/expr/irc-message-stream)
> A tiny Stream interface for [irc-message](https://github.com/expr/irc-message).

## Installation

`npm install irc-message-stream`

## Usage

```JavaScript
var net = require("net"),
    MessageStream = require("irc-message-stream");

var messageStream = new MessageStream;

messageStream.on("line", function(line) {
    console.log("Got raw line: " + line);
});

messageStream.on("data", function(message) {
    console.log("Got parsed message: " + JSON.stringify(message));
});

var freenode_conn = net.connect(6667, "irc.freenode.net");
freenode_conn.pipe(messageStream);
```
