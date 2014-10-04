var net = require("net"),
    MsgStream = new (require("../"));

console.log("connecting to freenode...");

net.connect(6667, "irc.freenode.net").pipe(MsgStream);

MsgStream.on("data", function(obj) {
    console.log(obj);
});
