/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var os                = require("os");
var process           = require('process');
var cluster           = require('cluster');
var CronJob           = require('cron').CronJob;
var WebScraperProcess = rootRequire("web_scraper/web_scraper_process");
var logger            = rootRequire('service/logger_manager');
var config            = rootRequire('config');

function setupCronJob(){
  // var job = new CronJob({
  //   cronTime: '* * * * * *',
  //   onTick: function() {
  //     console.log("haha");
  //   },
  //   start: true,
  //   timeZone: 'Hongkong'
  // });
}

function startUpProcess(workerProcess,pid,controllerCount,domainWhiteList){
  workerProcess = new WebScraperProcess(
    process.pid,
    config.scraper.controller_count,
    domainWhiteList
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

var main = function(){

  var domainWhitList = ["getproxy.jp",'gatherproxy.com','xroxy.com'];

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

      //// kill worker
      //cluster.worker.destroy()

      cluster.on('exit', function(deadWorker, code, signal) {

          // if (deadWorker.suicide === true) {
          //   //will be called if cluster.worker.destroy()
          //   console.log(new Date()+' Worker committed suicide');
          //   cluster.fork();
          // }

          logger.warn('Worker ' + deadWorker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);

          var popIndex = null;
          var pushWorker = null;

          for (var i = workerList.length - 1; i >= 0; i--) {
            var worker = workerList[i];
            if(deadWorker === worker){
              popIndex  = i;
              logger.warn('Starting a new worker');
              pushWorker = cluster.fork();
              break;
            }
          }

          if(popIndex === null || pushWorker === null){
            logger.error("cannot find deadWorker in workerList, how come");
          }

          workerList.splice(popIndex, 1);
          workerList.push(pushWorker);
      });

      setupCronJob();

    } else {

      var workerId = process.env.WorkerId;
      var numberOfDomainProcess =  Math.floor( domainWhitList.length / numWorkers );
      var sliceStartingIndex = workerId  * numberOfDomainProcess;
      var sliceEndIndex = sliceStartingIndex + numberOfDomainProcess;
      var processDomain = domainWhitList.slice(sliceStartingIndex, sliceEndIndex);

      startUpProcess(
        workerProcess,
        process.pid,
        config.scraper.controller_count,
        processDomain
      );
    }
  }else{
    startUpProcess(
      workerProcess,
      process.pid,
      config.scraper.controller_count,
      domainWhitList
    );

    setupCronJob();
  }
};

if (require.main === module) {
    main();
}
