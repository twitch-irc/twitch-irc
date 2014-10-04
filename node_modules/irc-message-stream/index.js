var parseMessage = require("irc-message").parseMessage;
var lstream = require("lstream");
var through = require("through");

module.exports = function messageStream () {
    var lineStream = new lstream();

    var stream = through(function (data) {
        lineStream.write(data);
    }, function () {
        lineStream = null;
    });

    lineStream.on("data", function (line) {
        var message = parseMessage(line);

        if (message === null) {
            var error = new Error("Invalid line read: " + line);
            return stream.emit("error", error);
        }

        stream.queue(message);
    });

    return stream;
}
