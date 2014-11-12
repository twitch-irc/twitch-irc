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

var tempUserData = {};
var channelUserData = {};

/**
 * Create a temporary user data.
 * @param username
 */
function createTempUserData(username) {
	if (!tempUserData[username]) {
		tempUserData[username] = {
			username: username,
			special: [],
			color: '#696969',
			emote: []
		};
	}
}

/**
 * Insert the user data into the channel data.
 * @param channel
 * @param username
 * @param cb
 */
function createChannelUserData(channel, username, cb) {
	if (!channelUserData[channel]) { channelUserData[channel] = {}; }
	if (!tempUserData[username]) { createTempUserData(username); }
	
	channelUserData[channel][username] = tempUserData[username];
	tempUserData[username] = null;
	
	cb();
}

// Export everything.
exports.tempUserData = tempUserData;
exports.createTempUserData = createTempUserData;
exports.createChannelUserData = createChannelUserData;
exports.channelUserData = channelUserData;