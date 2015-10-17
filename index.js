/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var http              = require('http');
var Promise           = require('bluebird');
var os                = require("os");
var cluster           = require('cluster');
var co                = require('co');
var ScrapHandlerLoader   = rootRequire("web_scraper/scrap_handler_loader");
var AgentConfigLoader   = rootRequire("web_scraper/agent_config_loader");
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var MongoManager      = rootRequire('service/mongo_manager');
var config     = rootRequire('config');

function WebScraperController(i,agentConfigLoader) {
  var self=this;
  this.id = i;
  this.agentConfigLoader = agentConfigLoader;
  this.beanstalkdClient = new BeanstalkdManager();
  this.mongodbClient    = new MongoManager();
  this.scrapHandlerLoader  = new ScrapHandlerLoader();
  this.isStopped   = false;
}

WebScraperController.prototype.down = function (){
  this.mongodbClient.close();
};

WebScraperController.prototype.onSeriousError = function(err) {
  logger.error(err.stack);
  process.exit(1);
};

WebScraperController.prototype.onMinorError = function(err){
  logger.warn(err.stack);
};

WebScraperController.prototype.up = function (){
    var self = this;
    logger.info("web scraper up and running..");
    co(function *(){
        while(!self.isStopped){
            console.time(self.id + "task-time")
            var urlRequest = yield self.beanstalkdClient.consumeURLRequest();
            var services   = {
            'beanstalkdClient': self.beanstalkdClient,
            'mongodbClient': self.mongodbClient
            };

            var HandlerClass = yield self.scrapHandlerLoader.getHandlerClassFor(urlRequest.url);
            if(HandlerClass === undefined){
              continue;
            }

            var agent = yield self.agentConfigLoader.findAgentFor(urlRequest.url);

            var handler = new HandlerClass(services,agent);

            yield handler
            .handle(urlRequest)
            .catch(self.onMinorError.bind(self));
            console.timeEnd(self.id + "task-time")
        }
    })
    .catch(self.onSeriousError.bind(self));
};

var main = function(){
  http.globalAgent.maxSockets = config.scraper.globalMaxSockets;
  //unlimit the Event Emitter
  process.setMaxListeners(0);

  if(config.scraper.cluster_mode === 1){
    if(cluster.isMaster) {
      var numWorkers = os.cpus().length;
      logger.info('Master cluster setting up ' + numWorkers + ' workers...');
      for(var i = 0; i < numWorkers; i++) {
          cluster.fork();
      }

      cluster.on('online', function(worker) {
          logger.info('Worker ' + worker.process.pid + ' is online');
      });

      cluster.on('listening', function(worker, address) {
        console.log("A worker is now connected to " + address.address + ":" + address.port);
      });

      cluster.on('exit', function(worker, code, signal) {
          logger.warn('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
          logger.warn('Starting a new worker');
          cluster.fork();
      });
    } else {
        var agentConfigLoader = new AgentConfigLoader();
        var controller = new WebScraperController(agentConfigLoader).up();
    }
  }else{

    var controllerList = [];

    var agentConfigLoader = new AgentConfigLoader();
    for (var i = 5 - 1; i >= 0; i--) {
      var controller = new WebScraperController(i,agentConfigLoader);
      controllerList.push(controller);

      controller.up();
    }

    process.on('SIGINT', function() {
        logger.info("\nGracefully shutting down from SIGINT (Ctrl+C)");
        for (var i = controllerList.length - 1; i >= 0; i--) {
          controllerList[i].down();
        }
        process.exit(0);
    });
  }
};

if (require.main === module) {

    main();
}
