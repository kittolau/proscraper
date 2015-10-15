/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var Promise           = require('bluebird');
var co                = require('co');
var ScrapDispatcher   = rootRequire("web_scraper/scrap_dispatcher");
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var MongoManager      = rootRequire('service/mongo_manager');

function WebScraperController(isFullBlast) {
  var self=this;
  this.queueClient = new BeanstalkdManager();
  this.dbClient    = new MongoManager();
  this.dispatcher  = new ScrapDispatcher();
  this.isStopped   = false;
  this.isFullBlast = isFullBlast;

  process.on('SIGINT', function() {
      logger.info("Gracefully shutting down from SIGINT (Ctrl+C)");
      self.down(0);
  });
}

WebScraperController.prototype.down = function (exitVal){
  this.queueClient.close();
  this.dbClient.close();
  process.exit(exitVal);
};

WebScraperController.prototype.onError = function(err) {
  logger.error(err.stack);
  this.down(1);
};

WebScraperController.prototype.onDispatchError = function(err){
    logger.error(err.stack);
};

WebScraperController.prototype.up = function (){
    var self = this;

    logger.info("web scraper up and running..");
    co(function *(){
        while(!self.isStopped){
            var urlRequest = yield self.queueClient.consumeURLRequest();
            var services = { 'queueClient': self.queueClient, 'dbClient': self.dbClient};

            var HandlerClass = yield self.dispatcher.getHandlerClassFor(urlRequest.url);
            var handler = new HandlerClass(services);

            if(self.isFullBlast){
                handler.handle(urlRequest)
                    .catch(self.onDispatchError.bind(self));
            }else{
                yield handler.handle(urlRequest)
                    .catch(self.onDispatchError.bind(self));
            }

        }
    }).catch(self.onError.bind(self));
};

var main = function(){
    new WebScraperController(false).up();

    var seedQueueClient = new BeanstalkdManager();
    var urlRequest = new URLRequest("http://www.getproxy.jp/en/",'');
    seedQueueClient.putJob(urlRequest).then(function(){
        seedQueueClient.close();
    });

};

if (require.main === module) {
    main();
}
