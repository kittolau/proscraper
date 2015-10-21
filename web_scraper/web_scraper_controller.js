/* jshint node: true, esnext:true */
'use strict';
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

function WebScraperController(pid, id, domainTubeName, domainConfigLoader) {
  this.pid                = pid;
  this.id                 = id;
  this.domainConfigLoader = domainConfigLoader;
  this.scrapHandlerLoader = new ScrapHandlerLoader();
  this.isStopped          = false;
  this.beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, domainTubeName);
  this.mongodbClient      = new MongoManager();
  this.domainTubeName     = domainTubeName;
  this.services           = {
    'beanstalkdClient': this.beanstalkdClient,
    'mongodbClient': this.mongodbClient
  };
}

WebScraperController.prototype.down = function (){
  this.isStopped = true;
  this.mongodbClient.close();
  this.beanstalkdClient.close();
};

WebScraperController.prototype.onSeriousError = function(err) {
  logger.error(err);
  logger.error(err.stack);
  process.exit(1);
};

WebScraperController.prototype.onHandlerError = function(err){
  var urlRequest       = this.urlRequest;
  var beanstalkdClient = this.beanstalkdClient;

  if(urlRequest.isExccessDefaultRetryCount()){
    logger.error("Failed to scrap "+ urlRequest.url + ":\n" + err + "\n" + err.stack);
  }else{
    beanstalkdClient.putFailedURLRequest(urlRequest,null,10).catch(logger.error);
    logger.warn("Retry to scrap "+ urlRequest.url + ":\n" + err + "\n" + err.stack);
  }
};

// WebScraperController.prototype.dispatch = function(urlRequest,finish){
//   var self = this;
//   var startTime = Date.now();
//   Promise.all([
//     self.scrapHandlerLoader.getHandlerClassFor(urlRequest.url),
//     self.domainConfigLoader.findConfigFor(urlRequest.url)
//   ])
//   .spread(function(HandlerClass, domainConfig){
//     if(HandlerClass === undefined){
//       throw new Error("no HandlerClass");
//     }

//     var handler = new HandlerClass(urlRequest, self.services,domainConfig);

//     return handler.handle()
//     .catch(self.onHandlerError.bind({
//       urlRequest:urlRequest,
//       beanstalkdClient:self.beanstalkdClient
//     }));
//   })
//   .then(function(){
//     var duration = Date.now() - startTime;
//     logger.debug("Controller "+ self.pid+ "-"+self.id+" used "+duration+"ms to complete job");
//     finish();
//   })
//   .catch(self.onHandlerError.bind({
//     urlRequest:urlRequest,
//     beanstalkdClient:self.beanstalkdClient
//   }));
// };

// WebScraperController.prototype.up_async_queue = function(){
//   var self = this;

//   logger.debug("Controller "+ self.pid+ "-"+self.id+" is up");

//   var q = async.queue(self.dispatch.bind(self), self.asyncJobLimit);

//   q.drain = function() {
//     logger.debug("Controller "+ self.pid+ "-"+self.id+" processed all request");
//   };

//   co(function *(){
//     while(!self.isStopped){
//       var urlRequest = yield self.beanstalkdClient.consumeURLRequest();

//       q.push(urlRequest,function(err){
//         if(err){
//           self.onHandlerError(err).bind({
//             urlRequest:urlRequest,
//             beanstalkdClient:self.beanstalkdClient
//           });
//           return;
//         }
//       });
//     }
//   })
//   .catch(self.onSeriousError.bind(self));
// }


WebScraperController.prototype.up = function (){
    var self = this;

    logger.debug("Controller "+ self.pid+ "-"+self.id+" is up");

    co(function *(){
        while(!self.isStopped){


            var urlRequest = yield self.beanstalkdClient.consumeURLRequest();
            var services   = self.services;

            var startTime = Date.now();

            var HandlerClass = yield self.scrapHandlerLoader.getHandlerClassFor(urlRequest.url);
            if(HandlerClass === undefined){
              continue;
            }

            var domainConfig = yield self.domainConfigLoader.findConfigFor(urlRequest.url);
            var handler = new HandlerClass(urlRequest, services,domainConfig);

            yield handler
            .handle()
            .catch(self.onHandlerError
            .bind({
              urlRequest:urlRequest,
              beanstalkdClient:self.beanstalkdClient
            })
            );

            var duration = Date.now() - startTime;

            logger.info("Controller "+ self.pid+ "-"+self.id+" complete job: "+duration+" ms");
        }
    })
    .catch(self.onSeriousError.bind(self));
};

module.exports = WebScraperController;
