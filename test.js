/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var http               = require('http');
var Promise            = require('bluebird');
var os                 = require("os");
var cluster            = require('cluster');
var co                 = require('co');
var ScrapHandlerLoader = rootRequire("web_scraper/scrap_handler_loader");
var URLRequest         = rootRequire('web_scraper/url_request');
var logger             = rootRequire('service/logger_manager');
var BeanstalkdManager  = rootRequire("service/beanstalkd_manager");
var MongoManager       = rootRequire('service/mongo_manager');
var config             = rootRequire('config');
var async              = require('async');

// function onSeriousError(err) {
//   logger.error(err);
//   logger.error(err.stack);
//   process.exit(1);
// }

// function up_while_blocking(){
//       var beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, 'testtube');

//     co(function *(){
//         while(true){
//             var startTime = Date.now();

//             //this is non blocking call
//             // var urlRequest = yield beanstalkdClient.consumeURLRequest();


//             var duration = Date.now() - startTime;

//             console.log("Controller blocking used "+duration+"ms to complete job");
//         }
//     })
//     .catch(onSeriousError);
// }

// function up_while_timeout(timeout){
//       var beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, 'testtube');

//       var promgram_startime= Date.now();
//       var startTime
//     co(function *(){
//         while(true){

//           console.log("up_while_timeout started a jobs")
//           startTime = Date.now();

//           try{
//             //this is non blocking call
//             var urlRequest = yield beanstalkdClient.consumeURLRequestWithTimeout(timeout);

//           }catch(err){
//             console.log(err == 'Error: TIMED_OUT')
//             var duration = Date.now() - startTime;
//             console.log(Date.now() - promgram_startime+ "up_while_timeout used "+duration+"ms to complete job");
//           }
//         }
//     })
//     .catch(function(){
//       var duration = Date.now() - startTime;
//       console.log("up_while_timeout used "+duration+"ms to complete job");
//     });
// }

// function up_setinterval_timeout(){
//       var beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, 'testtube');

//     setInterval(function(){

//       console.log("up_setinterval_timeout started a jobs")
//       var startTime = Date.now();

//       beanstalkdClient.consumeURLRequestWithTimeout(3)
//       .then(function(){
//         console.log()
//       })
//       .catch(function(){
//         var duration = Date.now() - startTime;

//         console.log("up_setinterval_timeout used "+duration+"ms to complete job");
//       });
//     },1000);
// }

// var totalRequestTime = 0;
// var promgram_startime= Date.now();

// function random (low, high) {
//     return Math.random() * (high - low) + low;
// }

// function makeRequest(url, callback) {
//   /* make a http request */
//   var finishTime = random(300,1000);
//   totalRequestTime += finishTime;
//   setTimeout(function(){
//     console.log(Date.now() - promgram_startime +": done job " + url + " in " + finishTime);
//     callback();
//   },finishTime);
// }

// var q = async.queue(makeRequest, 100);

// q.drain = function() {
//   var promgram_duration = (Date.now() - promgram_startime) / 1000;
//   console.log("totalRequestTime: "+totalRequestTime);
//   console.log("avg RequestTime: "+ totalRequestTime / numberOfRequest);
//   console.log("avg job done per seconds: "+ numberOfRequest / promgram_duration);
// };

// var numberOfRequest = 1000;

// var urls = [];
// for (var i = numberOfRequest - 1; i >= 0; i--) {
//   urls.push(i);
// }

// var extraJobTime =
// setInterval(function(){
//   q.push('extra job');

// },100);

// q.push(urls);
// Promise.all([
//   new Promise.resolve("1"),
//   new Promise.resolve("2"),
// ])
// .spread(function(a,b){
//   console.log(a)
//   console.log(b)
// })

// async.forever(
//     function(next) {
//         // next is suitable for passing to things that need a callback(err [, whatever]);
//         // it will result in this function being called again.
//         console.log(next);
//         next('a');
//     },
//     function(err) {
//         // if next is called with a value in its first parameter, it will appear
//         // in here as 'err', and execution will stop.
//         console.log(err)
//     }
// );

// function a(){
//   process.nextTick(a)
// }
// a()

// var q = async.queue(function (task, callback) {
//     console.log('hello ' + task.name);
//     callback();
// }, 100);

// q.drain = function() {
//     console.log('all items have been processed');
// }

// q.push({name: 'foo'}, function (err) {
//     console.log('finished processing foo');
// });
// q.push({name: 'bar'}, function (err) {
//     console.log('finished processing bar');
// });

// q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function (err) {
//     console.log('finished processing item');
// });

// add some items to the front of the queue
// q.unshift({name: 'bar'}, function (err) {
//     console.log('finished processing bar');
// });

// var BloomFilter = require('bloomfilter').BloomFilter;
// var array = [];
// for (var i = 1000000 - 1; i >= 0; i--) {

//   array.push(new BloomFilter(8192, 16));
// };
// var sleep = require('sleep')
// sleep(100);

// up_while_blocking();
// up_while_blocking();
// up_while_timeout(1);
// up_while_timeout(10);
// up_while_timeout(1);
// up_while_timeout(1);
// up_while_timeout(1);
// up_while_timeout(1);
// up_while_timeout(1);
// up_while_timeout(1);
// //up_setinterval_timeout();
var url = require('url')
var Qs  = require('qs')

var urls="http://www.gatherproxy.com/proxylist/country/?c=Republic%20of%20Korea#2"
var urlParse = url.resolve(urls, null);
console.log(urlParse)

// console.log(urlParse.hash)
// console.log(urlParse.search)

// // console.log(Object.keys(urlParse.query).length === 0)


// // console.log(urlParse.query.c == "Republic of Korea")

// console.time("start")
// var string = /\?(?!.*\?)([^#]+)/g.exec(urls)[1];
// console.log(string)
// var obj = Qs.parse(string);    // { a: 'c' }
// var str = Qs.stringify(obj);  // 'a=c'
// console.log(obj.c);
// console.log(str);
// console.timeEnd("start")
// var CronJob = require('cron').CronJob;
// var job = new CronJob({
//   cronTime: '* * * * * *',
//   onTick: function() {
//     console.log("haha");
//   },
//   start: true,
//   timeZone: 'Hongkong'
// });

// console.log("test")
// console.log("11111111111")
// function a(){
//   return co(function*(){
//     return "111111"
//   }).catch(function(err){
//     console.log(err)
//     console.log(err.stack)
//   })
// }
// console.log(a())
// console.log("aaaaaaa")

