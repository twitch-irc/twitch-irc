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
var Extend      = require('jquery-extend');
var Querystring = require('querystring');

var defaults = {
    accessKey: null,
    apiBase: 'https://api.twitch.tv/kraken',
    apiVersion: '3',
    json: true,
    params: {},
    replacements: {},
    clientID: ''
};

module.exports = {
    twitch: function (channel, method, path, options, callback) {
        var self = this;

        channel = channel.replace('#', '');
        method = typeof method !== 'undefined' ? method : 'GET';

        var Database = Client.getDatabase();
        var collection = Database.collection('tokens');

        path = typeof path === 'string' ? path : '';
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = Extend({}, defaults, options);
        callback = typeof callback === 'function' ? callback : function () {};

        if (collection.where({channel: channel}).length >= 1) {
            options.accessKey = collection.where({channel: channel})[0].token;
        }

        // Replace tokens.
        for (var replacement in options.replacements) {
            if (!options.replacements.hasOwnProperty(replacement)) {
                continue;
            }
            path = path.replace(':' + replacement, options.replacements[replacement]);
        }

        options.params = Querystring.stringify(options.params);

        var requestSettings = {};
        requestSettings.url = options.apiBase + path + (options.params ? '?' + options.params : '');
        requestSettings.headers = {
            'Accept': 'application/vnd.twitchtv.v' + options.apiVersion + '+json',
            'Client-ID': options.clientID
        };

        requestSettings.method = method;

        if (options.accessKey) {
            requestSettings.headers['Authorization'] = 'OAuth ' + options.accessKey;
        }

        Request(requestSettings, function (error, response, body) {
            if (error) {
                return callback.call(self, error);
            }
            if (options.json) {
                try {
                    body = JSON.parse(body);
                }
                catch (error) {
                    return callback.call(self, error);
                }
            }
            return callback.call(self, null, response.statusCode, body);
        });

        return this;
    }
};