var assert = require('assert')
var iso8601 = require('./')

describe('#toDate()', function() {
    it('converts properly formed ISO8601 strings', function() {
        var date = new Date(1325471624000)
        assert.equal(iso8601.fromDate(date), '2012-01-02T02:33:44Z')
    })

    it('handles time zone offsets', function() {
        var plusOne = iso8601.toDate('2012-12-12T08:00:00+01:00')
        var plusTwo = iso8601.toDate('2012-12-12T09:00:00+02:00')

        assert.equal(plusOne.getTime(), plusTwo.getTime())
    })

    it('handles minutes in time zone offsets', function() {
        var plusOne = iso8601.toDate('2012-04-09T08:00:00Z')
        var plusTwo = iso8601.toDate('2012-04-09T05:30:00-02:30')

        assert.equal(plusOne.getTime(), plusTwo.getTime())
    })

    it('returns null after invalid date string', function() {
        assert.equal(iso8601.toDate('helloworld'), null)
        assert.equal(iso8601.toDate(''), null)
    })
})

describe('#fromDate()', function() {
    it('produces a correct ISO8601 string for a given Date', function() {
        var date = new Date(1325471624000)
        assert.equal(iso8601.fromDate(date), '2012-01-02T02:33:44Z')
    });
})