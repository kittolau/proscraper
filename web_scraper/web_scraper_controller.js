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

function WebScraperController(pid, id, domainConfigLoader) {
  var self=this;
  this.pid = pid;
  this.id = id;
  this.domainConfigLoader = domainConfigLoader;
  this.beanstalkdClient = new BeanstalkdManager();
  this.mongodbClient    = new MongoManager();
  this.scrapHandlerLoader  = new ScrapHandlerLoader();
  this.isStopped   = false;
}

WebScraperController.prototype.down = function (){
  this.mongodbClient.close();
  this.beanstalkdClient.close();
};

WebScraperController.prototype.onSeriousError = function(err) {
  logger.error(err.stack);
  process.exit(1);
};

WebScraperController.prototype.onHandlerError = function(err){
  var urlRequest = this.urlRequest;
  var beanstalkdClient = this.beanstalkdClient;

  if(urlRequest.getRetryCount() >= config.scraper.retry_count){
    logger.error("Failed to scrap "+ urlRequest.url + ":\n"+err.stack);
  }else{
    var retryUrlRequest = URLRequest.createFromFailedURLRequest(urlRequest);
    beanstalkdClient
    .putURLRequest(retryUrlRequest)
    .catch(logger.error);
    logger.warn("Retry to scrap "+ urlRequest.url + ":\n"+err.stack);
  }
};

WebScraperController.prototype.up = function (){
    var self = this;
    logger.debug("WebScraperController "+ self.pid+ "-"+self.id+" Up");
    co(function *(){
        while(!self.isStopped){

            var startTime = Date.now();

            var urlRequest = yield self.beanstalkdClient.consumeURLRequest();
            var services   = {
              'beanstalkdClient': self.beanstalkdClient,
              'mongodbClient': self.mongodbClient
            };

            var HandlerClass = yield self.scrapHandlerLoader.getHandlerClassFor(urlRequest.url);
            if(HandlerClass === undefined){
              continue;
            }

            var domainConfig = yield self.domainConfigLoader.findConfigFor(urlRequest.url);
            var handler = new HandlerClass(services,domainConfig);

            yield handler
            .handle(urlRequest)
            .catch(self.onHandlerError.bind({urlRequest:urlRequest,beanstalkdClient:self.beanstalkdClient}));

            var duration = Date.now() - startTime;
            logger.info("WebScraperController "+ self.pid+ "-"+self.id+" used "+duration+" to complete job");
        }
    })
    .catch(self.onSeriousError.bind(self));
};

module.exports = WebScraperController;
