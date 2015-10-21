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

var main = function(){

  var domainWhitList = ["getproxy.jp",'spys.ru','gatherproxy.com','xroxy.com'];

  var workerProcess = null;
  process.on('SIGINT', function() {
      logger.warn("\nGracefully shutting down from SIGINT (Ctrl+C)");
      if(workerProcess !== null){
        workerProcess.down();
      }
      process.exit(0);
  });

  var numWorkers = os.cpus().length;

  if(config.scraper.cluster_mode === 1){
    if(cluster.isMaster) {

      var workerList = [];

      logger.info('Master cluster setting up ' + numWorkers + ' workers...');
      for(var i = 0; i < numWorkers; i++) {
          var worker = cluster.fork({WorkerId: i});
          workerList.push(worker);
      }

      cluster.on('online', function(worker) {
          logger.info('Worker ' + worker.process.pid + ' is online');
      });

      cluster.on('listening', function(worker, address) {
        logger.log("A worker is now connected to " + address.address + ":" + address.port);
      });

      cluster.on('exit', function(worker, code, signal) {
          logger.warn('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
          // logger.warn('Starting a new worker');
          // cluster.fork();
      });
    } else {

      var workerId = process.env.WorkerId;
      var numberOfDomainProcess =  Math.floor( domainWhitList.length / numWorkers );
      var sliceStartingIndex = workerId  * numberOfDomainProcess;
      var sliceEndIndex = sliceStartingIndex + numberOfDomainProcess;

      var processDomain = domainWhitList.slice(sliceStartingIndex, sliceEndIndex);

      workerProcess = new WebScraperProcess(
        process.pid,
        config.scraper.controller_count,
        processDomain
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

    }
  }else{

    workerProcess = new WebScraperProcess(
      process.pid,
      config.scraper.controller_count,
      domainWhitList
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

  }
};

if (require.main === module) {
    main();
}
