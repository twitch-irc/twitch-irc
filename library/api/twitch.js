/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Schmoopiie
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

var Client      = require('../client');
var Request     = require('request');
var Querystring = require('querystring');

module.exports = {
    twitch: function (channel, method, path, options, callback) {
        var self = this;

        channel = typeof channel !== 'undefined' ? channel : 'no_channel_specified';
        channel = channel.replace('#', '');
        method = typeof method !== 'undefined' ? method : 'GET';
        options = typeof options !== 'undefined' ? options : {};

        var Database = Client.getDatabase();
        var collection = Database.collection('tokens');
        var token = '';

        path = typeof path === 'string' ? path : '';
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        callback = typeof callback === 'function' ? callback : function () {};

        if (collection.where({channel: channel}).length >= 1) {
            token = collection.where({channel: channel})[0].token;
        }

        options = Querystring.stringify(options);

        var requestOptions = {
            url: 'https://api.twitch.tv/kraken' + path + (options ? '?' + options : ''),
            headers: {
                'Accept': 'application/vnd.twitchtv.v3+json',
                'Client-ID': ''
            },
            method: method
        };

        if (options.accessKey) {
            requestOptions.headers['Authorization'] = 'OAuth ' + token;
        }

        Request(requestOptions, function (error, response, body) {
            if (error) {
                return callback.call(self, error);
            }
            try {
                body = JSON.parse(body);
            }
            catch (error) {
                return callback.call(self, error);
            }
            return callback.call(self, null, response.statusCode, body);
        });

        return this;
    }
};