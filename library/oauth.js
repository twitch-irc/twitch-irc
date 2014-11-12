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

var Chalk    = require('chalk');
var Express  = require('express');
var Locally  = require('locallydb');
var Method   = require('method-override');
var Parser   = require('body-parser');
var Passport = require('passport');
var Strategy = require('passport-twitch').Strategy;

var App      = Express();

/**
 * Customizing the logger for a better understanding of what's going on.
 * @param config
 * @returns {exports}
 */
module.exports = function(config) {
    var useOAuth = (typeof config.oauth != 'undefined') ? config.oauth : false;
    if (useOAuth) {
        this.options = config || {};
        var options = config.options || {};
        var debug = options.debug || false;

        var port = this.options.oauth.port || 51230;
        var clientID = this.options.oauth.clientID || '';
        var clientSecret = this.options.oauth.clientSecret || '';
        var scopes = this.options.oauth.scopes || '';

        if (clientID.trim() === '' || clientSecret.trim() === '' || scopes.trim() === '') {
            // Not using oauth
        } else {
            var callback = 'http://127.0.0.1:'+port+'/auth/twitch/callback';
            if (debug) {
                if (port !== 80) {
                    console.log(Chalk.yellow('oauth') + ': http://127.0.0.1:' + port);
                } else {
                    console.log(Chalk.yellow('oauth') + ': http://127.0.0.1');
                }
                console.log(Chalk.yellow('callback') + ': ' + callback);
            }
            Passport.serializeUser(function (user, done) {
                done(null, user);
            });

            Passport.deserializeUser(function (obj, done) {
                done(null, obj);
            });

            Passport.use(new Strategy({
                    clientID: clientID,
                    clientSecret: clientSecret,
                    callbackURL: callback,
                    scope: scopes
                },
                function (accessToken, refreshToken, profile, done) {
                    process.nextTick(function () {
                        var db = new Locally('./database');
                        var collection = db.collection('tokens');
                        collection.insert({channel: profile.username.toLowerCase(), token: accessToken});
                        collection.save();
                        return done(null, profile);
                    });
                }
            ));

            App.use(Express.static(__dirname + '/../oauth/public'));

            App.use(Parser.urlencoded({
                extended: true
            }));
            App.use(Parser.json());
            App.use(Method());

            App.set('views', __dirname + '/../oauth/views');
            App.engine('.html', require('ejs').renderFile);
            App.set('view engine', 'html');
            App.set('view options', {
                layout: false
            });
            App.use(Express.Router());

            App.use(Passport.initialize());
            App.use(Passport.session());


            App.get('/', Passport.authenticate('twitch', {
                scope: scopes.split(',')
            }), function (req, res) {
                //
            });

            App.get('/failed', function (req, res) {
                res.render('failed.html');
            });

            App.get('/success', function (req, res) {
                res.render('success.html');
            });

            App.get('/auth/twitch/callback', Passport.authenticate('twitch', {
                failureRedirect: '/failed'
            }), function (req, res) {
                res.redirect('/success');
            });

            App.listen(port, '0.0.0.0');
        }
    }
};