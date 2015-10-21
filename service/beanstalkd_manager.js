/* jshint node: true, esnext:true */
'use strict';
var Promise = require('bluebird');
var co = require('co');
var fivebeans = require('fivebeans');
var logger = rootRequire('service/logger_manager');
var config = rootRequire('config');
var URLRequest        = rootRequire('web_scraper/url_request');

var BeanstalkdManager = function (connectionConfig, domainTubeName) {

  var host = connectionConfig.host;
  var port = connectionConfig.port;
  if(typeof connectionConfig != "object"){
    throw new Error("connectionConfig is expeced as object, but given: "+connectionConfig);
  }
  if(!connectionConfig.host || !connectionConfig.port){
    throw new Error("host & port is expected in !connectionConfig, given host: " + host + ", port: " + port);
  }

  if(domainTubeName && typeof domainTubeName != 'string'){
    throw new Error("domainTubeName is expected string, but given " + domainTubeName);
  }
  this.host           = host;
  this.port           = port;
  this.watchTubeArray = [domainTubeName];
  this.useDomainTube  = [domainTubeName];
  this.watchClientPromise = this.__buildWatchClientPromise(host, port, this.watchTubeArray);
  this.useClientPromise   = this.__buildUseClientPromise(host, port, this.useDomainTube);

};

BeanstalkdManager.prototype.close = function (){
  this.watchClientPromise
  .then(function(client){
    client.stop();
  })
  .catch(logger.error);

  this.useClientPromise
  .then(function(client){
    client.stop();
  })
  .catch(logger.error);
};

BeanstalkdManager.prototype.lookUpTubeStat = function(){
  var self = this;

  return this.useClientPromise
  .then(function(client){
    return client.stats_tubeAsync(self.useDomainTube[0]);
  });
};

BeanstalkdManager.prototype.putURLRequest = co.wrap(function* (urlRequest, unimportantLevel, delayInSeconds, allowedTimeToRunInSeconds){
  if(urlRequest.constructor.name !== 'URLRequest'){
    throw new Error("urlRequest is not type of URLRequest");
  }
  return yield this.__putJob(
    URLRequest.prototype.__createNew(urlRequest),
    unimportantLevel,
    delayInSeconds,
    allowedTimeToRunInSeconds
  );
});

BeanstalkdManager.prototype.putResetDepthURLRequest = co.wrap(function* (urlRequest, unimportantLevel, delayInSeconds, allowedTimeToRunInSeconds){
  if(urlRequest.constructor.name !== 'URLRequest'){
    throw new Error("urlRequest is not type of URLRequest");
  }
  return yield this.__putJob(
    URLRequest.prototype.__createResetDepth(urlRequest),
    unimportantLevel,
    delayInSeconds,
    allowedTimeToRunInSeconds
  );
});

BeanstalkdManager.prototype.putDepthURLRequest = co.wrap(function* (urlRequest, unimportantLevel, delayInSeconds, allowedTimeToRunInSeconds){
  if(urlRequest.constructor.name !== 'URLRequest'){
    throw new Error("urlRequest is not type of URLRequest");
  }
  return yield this.__putJob(
    URLRequest.prototype.__createDeep(urlRequest),
    unimportantLevel,
    delayInSeconds,
    allowedTimeToRunInSeconds
  );
});

BeanstalkdManager.prototype.putFailedURLRequest = co.wrap(function* (urlRequest, unimportantLevel, delayInSeconds, allowedTimeToRunInSeconds){
  if(urlRequest.constructor.name !== 'URLRequest'){
    throw new Error("urlRequest is not type of URLRequest");
  }

  return yield this.__putJob(
    URLRequest.prototype.__createNewFailed(urlRequest),
    unimportantLevel,
    delayInSeconds,
    allowedTimeToRunInSeconds
  );
});

BeanstalkdManager.prototype.__putJob = function (payload, priority, delay, ttr){
  if (typeof(priority) ==='undefined' || priority === null) priority = 1;
  if (typeof(delay)    ==='undefined' || delay === null) delay = 0;
  if (typeof(ttr)      ==='undefined' || ttr === null) ttr = 1000;

  return this
  .useClientPromise
  .then(function(client){
    return client.putAsync(priority, delay, ttr, JSON.stringify(payload));
  })
  .then(function(jobid){
    logger.debug("Created job #" + jobid);
  });
};

BeanstalkdManager.prototype.consumeURLRequestWithTimeout = function (seconds){
  return this.__consumeJob_with_timeout(seconds).then(URLRequest.prototype.__createNew);
};

BeanstalkdManager.prototype.consumeURLRequest = function (){
  return this.__consumeJob().then(URLRequest.prototype.__createNew);
};

//return undefined if timeout, also, err will be 'Error: TIMED_OUT'
BeanstalkdManager.prototype.__consumeJob_with_timeout = co.wrap(function*(seconds){
  var client = yield this.watchClientPromise;

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
  var client = yield this.watchClientPromise;

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
  return client
  .useAsync(tubeName) // the tubes which .put() puts to
  .then(function(retTubeName) {
    logger.debug("Using tube: '" + tubeName + "'");
  });
};

BeanstalkdManager.prototype.__watchTube = function(client, tubeName){
  return client
  .watchAsync(tubeName) // the tubes which .reserve() is subscribed to
  .then(function(retTubeNumber) {
    logger.debug("Watching tube: '" + tubeName + "')");
  });
};

BeanstalkdManager.prototype.__buildConnectionClientPromise = function(host, port){
  return new Promise(function(resolve, reject){
    var client = new fivebeans.client(host, port);
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
};

BeanstalkdManager.prototype.__buildWatchClientPromise = co.wrap(function* (host, port, watchTubeArray){
  var self = this;
  var connectedClient = yield this.__buildConnectionClientPromise(host, port);

  for (var i = watchTubeArray.length - 1; i >= 0; i--) {
    var tubeName = watchTubeArray[i];
    yield self.__watchTube(connectedClient,tubeName);
  }

  return connectedClient;
});

BeanstalkdManager.prototype.__buildUseClientPromise = co.wrap(function* (host, port, useTubeArray){
  var self = this;
  var connectedClient = yield this.__buildConnectionClientPromise(host, port);

  for (var i = useTubeArray.length - 1; i >= 0; i--) {
    var tubeName = useTubeArray[i];
    yield self.__useTube(connectedClient,tubeName);
  }

  return connectedClient;
});

module.exports = BeanstalkdManager;
