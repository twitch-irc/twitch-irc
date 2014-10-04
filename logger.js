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

var logger = require('winston');
var mkdirp = require('mkdirp');

/**
 * Customizing the logger for a better understanding of what's going on.
 * @param config
 * @returns {exports}
 */
module.exports = function(config) {
	var debug = config.options.debug || false;
	var logging = config.options.logging || false;
	
	logger.setLevels({
		raw:0,
		event: 1,
		error:2,
		crash: 3
	});

	logger.addColors({
		raw: 'cyan',
		event: 'green',
		error: 'red',
		crash: 'red'
	});

	logger.remove(logger.transports.Console);
	
	if (debug) { logger.add(logger.transports.Console, { level: 'raw', colorize:true }); }
	
	if (logging) {
		mkdirp('./logs', function (err) {
		    if (err) { logger.error(err); }
		    else {
		    	logger.add(logger.transports.File, { level: 'raw', filename: './logs/status.log' });
		    	logger.handleExceptions(new logger.transports.File({ filename: './logs/exceptions.log' }))
		    }
		});
	}
	
	return logger;
};