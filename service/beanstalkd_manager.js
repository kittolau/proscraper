/* jshint node: true, esnext:true */
'use strict';
var Promise = require('bluebird');
var co = require('co');
var bs = require('nodestalker');
var logger = rootRequire('service/logger_manager');
var config = rootRequire('config');
var URLRequest        = rootRequire('web_scraper/url_request');

var BeanstalkdManager = function () {
  this.client = null;
};

BeanstalkdManager.prototype.__getClient = function (){
  if(this.client === null){
    this.client = this.__buildClient();
  }
  return this.client;
};

BeanstalkdManager.prototype.close = function (){
  if(this.client === null){
    return;
  }
  this.client.disconnect();
};

BeanstalkdManager.prototype.putURLRequest = co.wrap(function* (urlRequest, priority, delay, ttr){
  if(urlRequest.constructor.name !== 'URLRequest'){
    throw new Error("urlRequest is not type of URLRequest");
  }
  yield this.putJob(urlRequest,priority,delay,ttr);
});

BeanstalkdManager.prototype.putJob = co.wrap(function* (payload, priority, delay, ttr){
  if (typeof(priority) ==='undefined') priority = 1;
  if (typeof(delay)    ==='undefined') delay = 0;
  if (typeof(ttr)      ==='undefined') ttr = 1000;

  var client = this.__getClient();

  yield new Promise(function(resolve, reject){
    client.use(config.beanstalkd.tube_name)
      .onSuccess(function(tube_name) {
        logger.info("using '" + tube_name + "'");
        resolve();
      })
      .onError(function(err){
        logger.error("error '" + err + "'");
        reject();
      });
  });

  return new Promise(function(resolve, reject){
    client.put(JSON.stringify(payload), priority, delay, ttr)
      .onSuccess(function(job_id) {
        logger.info("created job #" + job_id);
        resolve(job_id);
      })
      .onError(function(err){
        logger.error("error '" + err + "'");
        reject();
      });
  });
});

BeanstalkdManager.prototype.consumeURLRequest = co.wrap(function* (){
  var payload = yield this.consumeJob();
  var urlRequest = URLRequest.createfromURLRequest(payload);
  return urlRequest;
});

BeanstalkdManager.prototype.consumeJob = co.wrap(function*(){
  var client = this.__getClient();

  yield new Promise(function(resolve, reject){
    client.watch(config.beanstalkd.tube_name).onSuccess(function(data) {
      resolve();
    });
  });

  var result = yield new Promise(function(resolve, reject){
    client.reserve().onSuccess(function(job) {
        resolve(job);
    });
  });

  var job_id  = result.id;
  var payload = JSON.parse(result.data);

  logger.info("reserved job #" + job_id);
  logger.debug(result);

  yield new Promise(function(resolve, reject){
    client.deleteJob(job_id).onSuccess(function(del_msg) {
      logger.info("deleted job #" + job_id);
      resolve();
    });
  });

  return payload;
});

BeanstalkdManager.prototype.__buildClient = function(){
  var BEANSTALKD_URL = config.beanstalkd.host;
  var BEANSTALKD_PORT = config.beanstalkd.port;
  var client = bs.Client(BEANSTALKD_URL + ":" + BEANSTALKD_PORT);
  return client;
};

module.exports = BeanstalkdManager;
