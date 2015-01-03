/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Schmoopiie
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

function stringifyPrimitive(v) {
    switch (typeof v) {
        case 'string': return v;
        case 'boolean': return v ? 'true' : 'false';
        case 'number': return isFinite(v) ? v : '';
        default: return '';
    }
}

module.exports = {
    stringifyPrimitive: function(v) {
        switch (typeof v) {
            case 'string': return v;
            case 'boolean': return v ? 'true' : 'false';
            case 'number': return isFinite(v) ? v : '';
            default: return '';
        }
    },
    queryString: function(object) {
        if (object === null || !object) { object = {}; }

        return Object.keys(object).map(function(k) {
            var ks = encodeURIComponent(stringifyPrimitive(k)) + '=';
            if (Array.isArray(object[k])) {
                return object[k].map(function(v) {
                    return ks + encodeURIComponent(stringifyPrimitive(v));
                }).join('&');
            } else {
                return ks + encodeURIComponent(stringifyPrimitive(object[k]));
            }
        }).join('&');
    },
    versionCompare: function(v1, v2, options) {
        var lexicographical = options && options.lexicographical;
        var zeroExtend      = options && options.zeroExtend;
        var v1parts         = v1.split('.');
        var v2parts         = v2.split('.');

        function isValidPart(x) { return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x); }

        if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) { return NaN; }
        if (zeroExtend) {
            while (v1parts.length < v2parts.length) v1parts.push("0");
            while (v2parts.length < v1parts.length) v2parts.push("0");
        }
        if (!lexicographical) {
            v1parts = v1parts.map(Number);
            v2parts = v2parts.map(Number);
        }
        for (var i = 0; i < v1parts.length; ++i) {
            if (v2parts.length == i) { return 1; }
            if (v1parts[i] == v2parts[i]) { continue; }
            else if (v1parts[i] > v2parts[i]) { return 1; }
            else { return -1; }
        }
        if (v1parts.length != v2parts.length) { return -1; }
        return 0;
    },
    addHash: function(string) {
        return string.substring(0,1) !== '#' && '#' + string || string;
    },
    remHash: function(string) {
        return string.replace('#', '');
    }
};