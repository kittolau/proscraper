/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var os                = require("os");
var process           = require('process');
var cluster           = require('cluster');
var WebScraperProcess = rootRequire("web_scraper/web_scraper_process");
var logger            = rootRequire('service/logger_manager');
var config            = rootRequire('config');
var URLRequest        = rootRequire('web_scraper/url_request');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");

var main = function(){

  var workerProcess = null;

  process.on('SIGINT', function() {
      logger.warn("\nGracefully shutting down from SIGINT (Ctrl+C)");
      if(workerProcess !== null){
        workerProcess.down();
      }

      console.timeEnd("pid "+ process.pid);

      process.exit(0);
  });

  console.time("pid "+ process.pid);

  workerProcess = new WebScraperProcess(process.pid, config.scraper.controller_count);
  workerProcess.applyProcessGlobalSetting();
  workerProcess.up();

  var seedQueueClient = new BeanstalkdManager();
  var urlRequest = new URLRequest("http://www.getproxy.jp/en/",'');
  seedQueueClient
  .putURLRequest(urlRequest)
  .then(function(){
    seedQueueClient.close();
  });

};

if (require.main === module) {
    main();
}
