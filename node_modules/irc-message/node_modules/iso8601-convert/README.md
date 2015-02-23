# iso8601-convert
> Convert between ISO8601 strings and Date objects

Alternative to `Date.parse()` with support for leap seconds. A fork of [calmh/node-iso8601](https://github.com/calmh/node-iso8601).

## Installation

    npm install iso8601-convert

## Usage

```js
var iso8601 = require('iso8601-convert')

// convert ISO 8601 date string to Date object
console.log(iso8601.toDate('2012-05-21T23:32:12.419Z'))
// convert Date object to ISO 8601 date string
console.log(iso8601.fromDate(Date.now()))
```
