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

var Express  = require('express');
var Locally  = require('locallydb');
var Method   = require('method-override');
var Parser   = require('body-parser');
var Passport = require('passport');
var Session  = require('express-session')
var Strategy = require('passport-twitch').Strategy;

var App      = Express();
var Database = null;
var DBPath   = './database';

/**
 * Creating a web server and handle OAuth 2.0 for Twitch.
 *
 * @param config
 * @returns {exports}
 */
module.exports = function(client, config) {
    var config = config || {};
    var useOAuth = (typeof config.oauth != 'undefined') ? config.oauth : false;
    if (useOAuth) {
        this.options     = config || {};
        var options      = config.options || {};
        var assets       = this.options.oauth.assets || __dirname + '/../oauth/public';
        var hostname     = this.options.oauth.hostname || '127.0.0.1';
        var port         = this.options.oauth.port || 51230;
        var clientID     = this.options.oauth.clientID || '';
        var clientSecret = this.options.oauth.clientSecret || '';
        var redirect     = this.options.oauth.redirect || '';
        var scopes       = this.options.oauth.scopes || 'user_read';
        var views        = this.options.oauth.views || __dirname + '/../oauth/views';

        DBPath = (typeof options.database != 'undefined') ? options.database : './database';

        if (clientID.trim() === '' || clientSecret.trim() === '' || scopes.trim() === '') {
            // Not using OAuth..
        } else {
            var callback = 'http://' + hostname + ':' + port + '/auth/twitch/callback';
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
                        if (Database === null) {
                            Database = new Locally(DBPath);
                        }
                        var collection = Database.collection('tokens');
                        if (collection.where({channel: profile.username.toLowerCase()}).length >= 1) {
                            collection.update(collection.where({channel: profile.username.toLowerCase()})[0].cid, {channel: profile.username.toLowerCase(), token: accessToken, scopes: scopes});
                        } else {
                            collection.insert({channel: profile.username.toLowerCase(), token: accessToken, scopes: scopes});
                        }
                        collection.save();
                        profile.token = accessToken;
                        profile.scopes = scopes;
                        return done(null, profile);
                    });
                }
            ));

            App.use(Express.static(assets));

            App.use(Parser.urlencoded({
                extended: true
            }));
            App.use(Parser.json());
            App.use(Method());

            App.set('views', views);
            App.engine('.html', require('ejs').renderFile);
            App.set('view engine', 'html');
            App.set('view options', {
                layout: false
            });
            App.use(Express.Router());
            App.use(Session({
                secret: 'keyboard cat',
                resave: false,
                saveUninitialized: true
            }));

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

            App.get('/auth/twitch/callback', function(req, res, next) {
                var failURL = '/failed';
                if (redirect !== '') {
                    var firstSeperator = (decodeURIComponent(redirect).indexOf('?')== -1 ? '?' : '&');
                    failURL = decodeURIComponent(redirect) + firstSeperator + 'request=failed';
                }

                Passport.authenticate('twitch', function(err, user) {
                    if (err) {
                        client.emit('oauth', false, null, null, null);
                        return next(err);
                    }
                    if (!user) {
                        client.emit('oauth', false, null, null, null);
                        return res.redirect(failURL);
                    }
                    req.logIn(user, function(err) {
                        if (err) {
                            client.emit('oauth', false, null, null, null);
                            return next(err);
                        }
                        client.emit('oauth', true, req.user.username, req.user.token, req.user.scopes.split(','));

                        if (redirect !== '') {
                            var firstSeperator = (decodeURIComponent(redirect).indexOf('?')== -1 ? '?' : '&');
                            res.redirect(decodeURIComponent(redirect) + firstSeperator + 'request=success&username=' + req.user.username + '&token=' + req.user.token + '&scopes=' + req.user.scopes);
                        } else {
                            res.redirect('/success');
                        }
                        req.session.destroy(function(err) {});
                    });
                })(req, res, next);
            });

            App.listen(port, '0.0.0.0');
        }
    }
};