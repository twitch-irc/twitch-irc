var fs = require("fs"),
    MsgStream = new (require("../")),
    linecount = 0;

var lines = fs.createReadStream("filesystem_stream.txt");
lines.pipe(MsgStream);

MsgStream.on("data", function(obj) {
    linecount++;
    console.log(obj);
});

lines.on("close", function() {
    console.log("line count: " + linecount);
});