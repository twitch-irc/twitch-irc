var CronJob = require('./lib/cron').CronJob;
//var job = new CronJob({
			//cronTime: '00 * * * * *',
				//onTick: function() {
									//console.log("ticking:"+new Date());
											//},
				//start: false
//});
//job.start();




var counter =0;
var cronSyncSchedule = '10 49 00 25 */3 *';

var scheduleJob = new CronJob(cronSyncSchedule, function() {

	console.log("Current Time: " + new Date().getTime());
	counter++;
	// check for terminating condition
	console.log("Scheduler started run ::" +counter);
}, function() {
	console.log('scheduled job is completed successfully');

}, true, null);
