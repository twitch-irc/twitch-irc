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

var Client = require('../client');
var Promise  = require("promise");
var Request  = require('request');

function apiCall(channel, url, scope, method, data, expectJSON) {
    return new Promise(function (resolve, reject) {
        var Database = Client.getDatabase();
        var collection = Database.collection('tokens');

        if (collection.where({channel: channel}).length >= 1) {
            if (collection.where({channel: channel})[0].scopes.indexOf(scope) >= 0) {
                token = collection.where({channel: channel})[0].token;
                var options = {
                    url: url,
                    headers: {
                        'Authorization': 'OAuth ' + token
                    },
                    json: true,
                    method: method
                };
                if (data != null) {
                    options.body = data;
                }

                Request(options, function (error, response, body) {
                    if (!error && (response.statusCode == 200 || response.statusCode == 204)) {
                        if (expectJSON) {
                            resolve(body);
                        } else {
                            resolve(response.statusCode);
                        }
                    } else {
                        reject(response.statusCode);
                    }
                });
            } else {
                reject(901);
            }
        } else {
            reject(900);
        }
    });
}

function apiAnonymousCall(url, expectJSON) {
    return new Promise(function (resolve, reject) {
        Request(url, function (err, res, body) {
            if (!err && (res.statusCode == 200 || res.statusCode == 204)) {
                if (expectJSON) {
                    resolve(body);
                } else {
                    resolve(res.statusCode);
                }
            } else {
                reject(res.statusCode);
            }
        });
    });
}

module.exports = {
    api: {
        blocks: {
            get: function get(channel, limit, offset) {
                channel = channel.replace('#', '').toLowerCase();
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                return apiCall(channel, 'https://api.twitch.tv/kraken/users/' + channel + '/blocks?limit=' + limit + '&offset=' + offset, 'user_blocks_read', 'get', null, true);
            },
            put: function put(channel, target) {
                channel = channel.replace('#', '').toLowerCase();
                return apiCall(channel, 'https://api.twitch.tv/kraken/users/' + channel + '/blocks/' + target, 'user_blocks_edit', 'put', null, true);
            },
            delete: function remove(channel, target) {
                channel = channel.replace('#', '').toLowerCase();
                return apiCall(channel, 'https://api.twitch.tv/kraken/users/' + channel + '/blocks/' + target, 'user_blocks_edit', 'delete', null, false);
            }
        },
        channels: {
            get: {
                channel: function channel(channel) {
                    channel = channel.replace('#', '').toLowerCase();
                    return apiCall(channel, 'https://api.twitch.tv/kraken/channel', 'channel_read', 'get', null, true);
                },
                videos: function videos(channel, limit, offset) {
                    channel = channel.replace('#', '').toLowerCase();
                    limit = typeof limit !== 'undefined' ? limit : 10;
                    offset = typeof offset !== 'undefined' ? offset : 0;
                    return apiAnonymousCall('https://api.twitch.tv/kraken/channels/' + channel + '/videos?limit=' + limit + '&offset=' + offset, true);
                },
                follows: function follows(channel, limit, offset, direction) {
                    channel = channel.replace('#', '').toLowerCase();
                    limit = typeof limit !== 'undefined' ? limit : 25;
                    offset = typeof offset !== 'undefined' ? offset : 0;
                    direction = typeof direction !== 'undefined' ? direction : 'desc';
                    return apiAnonymousCall('https://api.twitch.tv/kraken/channels/' + channel + '/follows?limit=' + limit + '&offset=' + offset + '&direction=' + direction, true);
                },
                editors: function editors(channel) {
                    channel = channel.replace('#', '').toLowerCase();
                    return apiCall(channel, 'https://api.twitch.tv/kraken/channels/' + channel + '/editors', 'channel_read', 'get', null, true);
                },
                teams: function teams(channel) {
                    channel = channel.replace('#', '').toLowerCase();
                    return apiAnonymousCall('https://api.twitch.tv/kraken/channels/' + channel + '/teams', true);
                }
            },
            put: {
                channel: function channel(channel, data) {
                    channel = channel.replace('#', '').toLowerCase();
                    return apiCall(channel, 'https://api.twitch.tv/kraken/channels/' + channel, 'channel_editor', 'put', data, true);
                }
            },
            delete: {
                streamkey: function streamkey(channel) {
                    channel = channel.replace('#', '').toLowerCase();
                    return apiCall(channel, 'https://api.twitch.tv/kraken/channels/' + channel + '/stream_key', 'channel_stream', 'delete', null, false);
                }
            },
            post: {
                commercial: function commercial(channel, length) {
                    channel = channel.replace('#', '').toLowerCase();
                    length = typeof length !== 'undefined' ? length : 30;
                    var data = {
                        length: length
                    }
                    return apiCall(channel, 'https://api.twitch.tv/kraken/channels/' + channel + '/commercial', 'channel_commercial', 'post', data, false);
                }
            }
        },
        chat: {
            endpoints: function endpoints(channel) {
                channel = channel.replace('#', '').toLowerCase();
                return apiAnonymousCall('https://api.twitch.tv/kraken/chat/' + channel, true);
            },
            emoticons: function emoticons() {
                return apiAnonymousCall('https://api.twitch.tv/kraken/chat/emoticons', true);
            },
            badges: function badges(channel) {
                return new Promise(function (resolve, reject) {
                    Request('https://api.twitch.tv/kraken/chat/' + channel.toLowerCase() + '/badges', function (err, res, body) {
                        if (err) {
                            return reject(err);
                        } else if (res.statusCode !== 200) {
                            err = new Error("Unexpected status code: " + res.statusCode);
                            return reject(err);
                        }
                        resolve(body);
                    });
                });
            },
            chatters: function chatters(channel) {
                return new Promise(function (resolve, reject) {
                    Request('http://tmi.twitch.tv/group/user/' + channel.toLowerCase() + '/chatters', function (err, res, body) {
                        if (err) {
                            return reject(err);
                        } else if (res.statusCode !== 200) {
                            err = new Error("Unexpected status code: " + res.statusCode);
                            return reject(err);
                        }
                        resolve(body);
                    });
                });
            }
        },
        follows: {
            get: {
                followers: function followers(channel, limit, offset, direction) {
                    channel = channel.replace('#', '').toLowerCase();
                    limit = typeof limit !== 'undefined' ? limit : 10;
                    offset = typeof offset !== 'undefined' ? offset : 0;
                    direction = typeof direction !== 'undefined' ? direction : 'DESC';
                    return apiAnonymousCall('https://api.twitch.tv/kraken/channels/' + channel + '/follows?direction=' + direction + '&limit=' + limit + '&offset=' + offset, true);
                },
                follows: function follows(channel, limit, offset, direction, sortby) {
                    channel = channel.replace('#', '').toLowerCase();
                    limit = typeof limit !== 'undefined' ? limit : 10;
                    offset = typeof offset !== 'undefined' ? offset : 0;
                    direction = typeof direction !== 'undefined' ? direction : 'DESC';
                    sortby = typeof sortby !== 'undefined' ? sortby : 'created_at';
                    return apiAnonymousCall('https://api.twitch.tv/kraken/users/' + channel + '/follows/channels?direction=' + direction + '&sortby=' + sortby + '&limit=' + limit + '&offset=' + offset, true);
                },
                following: function following(channel, target) {
                    channel = channel.replace('#', '').toLowerCase();
                    target = target.replace('#', '').toLowerCase();
                    return apiAnonymousCall('https://api.twitch.tv/kraken/users/' + channel + '/follows/channels/' + target, true);
                },
                streams: function streams(channel, limit, offset, hls) {
                    channel = channel.replace('#', '').toLowerCase();
                    limit = typeof limit !== 'undefined' ? limit : 25;
                    offset = typeof offset !== 'undefined' ? offset : 0;
                    hls = typeof hls !== 'undefined' ? hls : false;
                    return apiCall(channel, 'https://api.twitch.tv/kraken/streams/followed?limit=' + limit + '&offset=' + offset + '&hls=' + hls, 'user_read', 'get', null, true);
                },
                videos: function videos(channel, limit, offset) {
                    channel = channel.replace('#', '').toLowerCase();
                    limit = typeof limit !== 'undefined' ? limit : 10;
                    offset = typeof offset !== 'undefined' ? offset : 0;
                    return apiCall(channel, 'https://api.twitch.tv/kraken/videos/followed?limit=' + limit + '&offset=' + offset, 'user_read', 'get', null, true);
                }
            },
            put: {
                follows: function follows(channel, target) {
                    channel = channel.replace('#', '').toLowerCase();
                    target = target.replace('#', '').toLowerCase();
                    return apiCall(channel, 'https://api.twitch.tv/kraken/users/' + channel + '/follows/channels/' + target, 'user_follows_edit', 'put', null, true);
                }
            },
            delete: {
                follows: function follows(channel, target) {
                    channel = channel.replace('#', '').toLowerCase();
                    target = target.replace('#', '').toLowerCase();
                    return apiCall(channel, 'https://api.twitch.tv/kraken/users/' + channel + '/follows/channels/' + target, 'user_follows_edit', 'delete', null, false);
                }
            }
        },
        games: {
            get: function get(limit, offset, hls) {
                limit = typeof limit !== 'undefined' ? limit : 10;
                offset = typeof offset !== 'undefined' ? offset : 0;
                hls = typeof hls !== 'undefined' ? hls : false;
                return apiAnonymousCall('https://api.twitch.tv/kraken/games/top?limit=' + limit + '&offset=' + offset + '&hls=' + hls, true);
            }
        },
        ingests: {
            get: function get() {
                return apiAnonymousCall('https://api.twitch.tv/kraken/ingests', true);
            }
        },
        root: {
            get: function get() {
                return apiAnonymousCall('https://api.twitch.tv/kraken', true);
            }
        },
        search: {
            channels: function channels(query, limit, offset) {
                query = typeof query !== 'undefined' ? query : '';
                limit = typeof limit !== 'undefined' ? limit : 10;
                offset = typeof offset !== 'undefined' ? offset : 0;
                return apiAnonymousCall('https://api.twitch.tv/kraken/search/channels?q=' + query + '&limit=' + limit + '&offset=' + offset, true);
            },
            streams: function streams(query, limit, offset, hls) {
                query = typeof query !== 'undefined' ? query : '';
                limit = typeof limit !== 'undefined' ? limit : 10;
                offset = typeof offset !== 'undefined' ? offset : 0;
                hls = typeof hls !== 'undefined' ? hls : false;
                return apiAnonymousCall('https://api.twitch.tv/kraken/search/streams?q=' + query + '&limit=' + limit + '&offset=' + offset + '&hls=' + hls, true);
            },
            games: function games(query, type, live) {
                query = typeof query !== 'undefined' ? query : '';
                type = typeof type !== 'undefined' ? type : 'suggest';
                live = typeof live !== 'undefined' ? live : false;
                return apiAnonymousCall('https://api.twitch.tv/kraken/search/games?q=' + query + '&type=' + type + '&live=' + live, true);
            }
        },
        streams: {
            channel: function channel(channel) {
                channel = channel.replace('#', '').toLowerCase();
                return apiAnonymousCall('https://api.twitch.tv/kraken/streams/' + channel, true);
            },
            streams: function streams(game, channels, limit, offset, embeddable, hls, client_id) {
                game = typeof game !== 'undefined' ? game : '';
                channels = typeof channels !== 'undefined' ? channels : '';
                limit = typeof limit !== 'undefined' ? limit : 10;
                offset = typeof offset !== 'undefined' ? offset : 0;
                embeddable = typeof embeddable !== 'undefined' ? embeddable : false;
                hls = typeof hls !== 'undefined' ? hls : false;
                client_id = typeof client_id !== 'undefined' ? client_id : '';
                return apiAnonymousCall('https://api.twitch.tv/kraken/streams?game=' + game + '&channel=' + channels + '&limit=' + limit + '&offset=' + offset + '&embeddable=' + embeddable + '&hls=' + hls + '&client_id=' + client_id, true);
            },
            featured: function featured(limit, offset, hls) {
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                hls = typeof hls !== 'undefined' ? hls : false;
                return apiAnonymousCall('https://api.twitch.tv/kraken/streams/featured?limit=' + limit + '&offset=' + offset + '&hls=' + hls, true);
            },
            summary: function summary(limit, offset, hls) {
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                hls = typeof hls !== 'undefined' ? hls : false;
                return apiAnonymousCall('https://api.twitch.tv/kraken/streams/summary?limit=' + limit + '&offset=' + offset + '&hls=' + hls, true);
            },
            followed: function followed(channel, limit, offset, hls) {
                channel = channel.replace('#', '').toLowerCase();
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                hls = typeof hls !== 'undefined' ? hls : false;
                return apiCall(channel, 'https://api.twitch.tv/kraken/streams/followed?limit=' + limit + '&offset=' + offset + '&hls=' + hls, 'user_read', 'get', null, true);
            }
        },
        subscriptions: {
            get: function get(channel, limit, offset, direction) {
                channel = channel.replace('#', '').toLowerCase();
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                direction = typeof direction !== 'undefined' ? direction : 'asc';
                return apiCall(channel, 'https://api.twitch.tv/kraken/channels/' + channel + '/subscriptions?limit=' + limit + '&offset=' + offset + '&direction=' + direction, 'channel_subscriptions', 'get', null, true);
            },
            user: function user(channel, target) {
                channel = channel.replace('#', '').toLowerCase();
                target = target.replace('#', '').toLowerCase();
                return apiCall(channel, 'https://api.twitch.tv/kraken/channels/' + channel + '/subscriptions/' + target, 'channel_subscriptions', 'get', null, true);
            },
            channel: function channel(channel, target) {
                channel = channel.replace('#', '').toLowerCase();
                target = target.replace('#', '').toLowerCase();
                return apiCall(channel, 'https://api.twitch.tv/kraken/users/' + channel + '/subscriptions/' + target, 'user_subscriptions', 'get', null, true);
            }
        },
        teams: {
            get: function get(limit, offset) {
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                return apiAnonymousCall('https://api.twitch.tv/kraken/teams?limit=' + limit + '&offset=' + offset, true);
            },
            team: function team(name) {
                name = typeof name !== 'undefined' ? name : '';
                return apiAnonymousCall('https://api.twitch.tv/kraken/teams/' + name, true);
            }
        },
        users: {
            get: function get(name) {
                name = name.replace('#', '').toLowerCase();
                return apiAnonymousCall('https://api.twitch.tv/kraken/users/' + name, true);
            },
            user: function user(channel) {
                channel = channel.replace('#', '').toLowerCase();
                return apiCall(channel, 'https://api.twitch.tv/kraken/user', 'user_read', 'get', null, true);
            },
            followed: function followed(channel, limit, offset, hls) {
                channel = channel.replace('#', '').toLowerCase();
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                hls = typeof hls !== 'undefined' ? hls : false;
                return apiCall(channel, 'https://api.twitch.tv/kraken/streams/followed?limit=' + limit + '&offset=' + offset + '&hls=' + hls, 'user_read', 'get', null, true);
            },
            videos: function videos(channel, limit, offset) {
                channel = channel.replace('#', '').toLowerCase();
                limit = typeof limit !== 'undefined' ? limit : 25;
                offset = typeof offset !== 'undefined' ? offset : 0;
                return apiCall(channel, 'https://api.twitch.tv/kraken/videos/followed?limit=' + limit + '&offset=' + offset, 'user_read', 'get', null, true);
            }
        },
        videos: {
            get: function get(id) {
                id = typeof id !== 'undefined' ? id : '';
                return apiAnonymousCall('https://api.twitch.tv/kraken/videos/' + id, true);
            },
            top: function top(limit, offset, game, period) {
                limit = typeof limit !== 'undefined' ? limit : 10;
                offset = typeof offset !== 'undefined' ? offset : 0;
                game = typeof game !== 'undefined' ? game : '';
                period = typeof period !== 'undefined' ? period : 'week';
                return apiAnonymousCall('https://api.twitch.tv/kraken/videos/top?game=' + game + '&period=' + period + '&limit=' + limit + '&offset=' + offset, true);
            },
            channel: function channel(channel, limit, offset, broadcasts) {
                channel = channel.replace('#', '').toLowerCase();
                limit = typeof limit !== 'undefined' ? limit : 10;
                offset = typeof offset !== 'undefined' ? offset : 0;
                broadcasts = typeof broadcasts !== 'undefined' ? broadcasts : false;
                return apiAnonymousCall('https://api.twitch.tv/kraken/channels/' + channel + '/videos?limit=' + limit + '&offset=' + offset + '&broadcasts=' + broadcasts, true);
            }
        }
    }
}