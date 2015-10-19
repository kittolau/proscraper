/* jshint node: true, esnext:true */
'use strict';
var Promise = require('bluebird');
var co = require('co');
var fivebeans = require('fivebeans');
var logger = rootRequire('service/logger_manager');
var config = rootRequire('config');
var URLRequest        = rootRequire('web_scraper/url_request');

var BeanstalkdManager = function () {
  this.clientPromise    = this.__buildClientPromise();
  this.putClientPromise = this.__buildClientPromise();
};

BeanstalkdManager.prototype.close = function (){
  this.clientPromise
  .then(function(client){
    client.stop();
  })
  .catch(logger.error);

  this.putClientPromise
  .then(function(client){
    client.stop();
  })
  .catch(logger.error);
};

BeanstalkdManager.prototype.lookUpTubeStat = function(){
  return this.clientPromise
  .then(function(client){
    return client.stats_tubeAsync(config.beanstalkd.tube_name);
  });
};

BeanstalkdManager.prototype.putURLRequest = co.wrap(function* (urlRequest, unimportantLevel, delayInSeconds, allowedTimeToRunInSeconds){
  if(urlRequest.constructor.name !== 'URLRequest'){
    throw new Error("urlRequest is not type of URLRequest");
  }
  return yield this.__putJob(urlRequest,unimportantLevel,delayInSeconds,allowedTimeToRunInSeconds);
});

BeanstalkdManager.prototype.__putJob = function (payload, priority, delay, ttr){
  if (typeof(priority) ==='undefined' || priority === null) priority = 1;
  if (typeof(delay)    ==='undefined' || delay === null) delay = 0;
  if (typeof(ttr)      ==='undefined' || ttr === null) ttr = 1000;

  return this
  .putClientPromise
  .then(function(client){
    return client.putAsync(priority, delay, ttr, JSON.stringify(payload));
  })
  .then(function(jobid){
    logger.debug("Created job #" + jobid);
  });
};

BeanstalkdManager.prototype.consumeURLRequestWithTimeout = function (){
  return this.__consumeJob_with_timeout().then(URLRequest.createfromURLRequest);
};

BeanstalkdManager.prototype.consumeURLRequest = function (){
  return this.__consumeJob().then(URLRequest.createfromURLRequest);
};

//return undefined if timeout, also, err will be 'Error: TIMED_OUT'
BeanstalkdManager.prototype.__consumeJob_with_timeout = co.wrap(function*(seconds){
  var client = yield this.clientPromise;

  var job = yield client.reserve_with_timeoutAsync(seconds);
  logger.debug("Reserved job #" + job[0]);

  var del_msg = yield client.destroyAsync(job[0]);
  logger.debug("Delete job #" + job[0]);

  var jobId  = job[0];
  var payload = JSON.parse(job[1]);
  logger.debug("Consumed job #" + jobId);
  logger.debug(payload);

  return payload;
});

BeanstalkdManager.prototype.__consumeJob = co.wrap(function*(){
  var client = yield this.clientPromise;

  var job = yield client.reserveAsync();
  logger.debug("Reserved job #" + job[0]);

  var del_msg = yield client.destroyAsync(job[0]);
  logger.debug("Delete job #" + job[0]);

  var jobId  = job[0];
  var payload = JSON.parse(job[1]);
  logger.debug("Consumed job #" + jobId);
  logger.debug(payload);

  return payload;
});

BeanstalkdManager.prototype.__useTube = function(client, tubeName){
  return client.useAsync(tubeName) // the tubes which .put() puts to
  .then(function(retTubeName) {
    logger.debug("Using tube: '" + tubeName + "'");
  });

};

BeanstalkdManager.prototype.__watchTube = function(client, tubeName){
  return client.watchAsync(tubeName) // the tubes which .reserve() is subscribed to
  .then(function(retTubeNumber) {
    logger.debug("Watching tube: '" + tubeName + "')");
  });
};

BeanstalkdManager.prototype.__buildClientPromise = co.wrap(function* (){
  var self = this;

  var connectedClient = yield new Promise(function(resolve, reject){
    var BEANSTALKD_URL  = config.beanstalkd.host;
    var BEANSTALKD_PORT = config.beanstalkd.port;
    var client          = new fivebeans.client(BEANSTALKD_URL, BEANSTALKD_PORT);
    Promise.promisifyAll(client);

    client
    .on('connect', function()
    {
        // client can now be used
        logger.debug("Beanstalkd connection up");
        resolve(client);
    })
    .on('error', function(err)
    {
        // connection failure
        reject(err);
    })
    .on('close', function()
    {
        // underlying connection has closed
        logger.debug("Beanstalkd connection down");
    })
    .connect();
  });

  var tubeName = config.beanstalkd.tube_name;
  yield [self.__useTube(connectedClient,tubeName), self.__watchTube(connectedClient,tubeName)];

  return connectedClient;
});

module.exports = BeanstalkdManager;
