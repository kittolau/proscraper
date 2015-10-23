/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var process           = require('process');
var WebScraperProcess = rootRequire("web_scraper/web_scraper_process");
var logger            = rootRequire('service/logger_manager');
var config            = rootRequire('config');
var URLRequest        = rootRequire('web_scraper/url_request');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");

var main = function(){

  var SEED_URL = "http://www.gatherproxy.com/proxylist/country/?c=Hong%20Kong";
  var DOMAIN_ID = 'gatherproxy.com';

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

  workerProcess = new WebScraperProcess(
    process.pid,
    config.scraper.controller_count,
    [DOMAIN_ID]
  );
  workerProcess.applyProcessGlobalSetting();
  workerProcess
  .allocateController()
  .then(function(){
    workerProcess.up();
  })
  .catch(function(err){
    logger.error(err);
    logger.error(err.stack);
  });

  //DONT USE THE SAME PROCESS TO SEED JOB, OTHER WISE the err stack is some how corrupted

  // var seedQueueClient = new BeanstalkdManager(config.beanstalkd, DOMAIN_ID);
  // var urlRequest = new URLRequest(SEED_URL);
  // seedQueueClient
  // .putURLRequest(urlRequest)
  // .then(function(){
  //   seedQueueClient.close();
  // });


};

if (require.main === module) {
    main();
}
