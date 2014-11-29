# jquery-extend

The point of this module is to provide the most up-to-date version of [jQuery](https://github.com/jquery/jquery)'s
`.extend` function for server-side use.

This function's operation is **100%** backed by jQuery's own testing suite.

The API is identical to [jQuery.extend](http://api.jquery.com/jQuery.extend/)

### Example

```js
var extend = require("jquery-extend");
var a = {a: {b: "c", d: "e"}};
var b = {a: {b: "x", f: "g"}};

// shallow copy
extend({}, a, b);       //=> {a: {b: "x", f: "g"}}

// deep copy
extend(true, {}, a, b); //=> {a: {b: "x", d: "e", f: "g"}}
```


### Tests

Test suite depends on [qunit](https://github.com/kof/node-qunit)

```sh
$ npm test
```


### License

Copyright 2013 jQuery Foundation and other contributors
http://jquery.com/
