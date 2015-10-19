/* jshint node: true, esnext:true */
var http                 = require('http');
var os                   = require("os");
var cluster              = require('cluster');
var co                   = require('co');
var WebScraperController = rootRequire("web_scraper/web_scraper_controller");
var DomainConfigLoader   = rootRequire("web_scraper/domain_config_loader");
var URLRequest           = rootRequire('web_scraper/url_request');
var logger               = rootRequire('service/logger_manager');
var BeanstalkdManager    = rootRequire("service/beanstalkd_manager");
var MongoManager         = rootRequire('service/mongo_manager');
var config               = rootRequire('config');

function WebScraperProcess(pid, numberOfController){
  var self = this;

  this.pid                  = pid;
  this.controllerStatusList = [];
  this.domainConfigLoader   = new DomainConfigLoader();
  // this.isOnDemandMode       = config.scraper.on_demand_controller_mode === 1;
  // this.jobProbingIntervalId = null;
  // this.pendingJobsProbingClient = null;

  for (var i = numberOfController - 1; i >= 0; i--) {
    var controller = new WebScraperController(this.pid, i, this.domainConfigLoader);
    var controllerStatus = {
      controller:controller,
      isUP : 0
    };

    this.controllerStatusList.push(controllerStatus);
  }

  // if(this.isOnDemandMode){
  //   if(config.scraper.pending_jobs_treshold <= 0){
  //     throw new Error("config.scraper.pending_jobs_treshold cannot be lower than 0");
  //   }
  //   if(config.scraper.on_demand_probe_seconds <= 0){
  //     throw new Error("config.scraper.on_demand_probe_seconds cannot be lower than 0");
  //   }

  //   var onDemandProbeSeconds = config.scraper.on_demand_probe_seconds * 1000;

  //   self.pendingJobsProbingClient = new BeanstalkdManager();
  //   self.jobProbingIntervalId = setInterval(function() {
  //     //if all controller is up, no needs to probe
  //     var numberOfUpController = self.getUpControllerCount();
  //     if(numberOfUpController == numberOfController){
  //       return;
  //     }
  //     self.pendingJobsProbingClient
  //     .lookUpTubeStat()
  //     .then(self.__onDemandManageController.bind(self));
  //   }, onDemandProbeSeconds);
  // }
}

// WebScraperProcess.prototype.__onDemandManageController = function(status){
//   var numberOfPendingJobs = status['total-jobs'] - status['cmd-delete'];
//   var numberOfControllerNeed = Math.floor( numberOfPendingJobs / config.scraper.pending_jobs_treshold );

//   for (var i = 0 ; i < this.controllerStatusList.length && numberOfControllerNeed > 0; i++) {
//     var controllerStatus = this.controllerStatusList[i];
//     if(controllerStatus.isUP === 0){
//       controllerStatus.isUP = 1;
//       controllerStatus.controller.up();
//       numberOfControllerNeed--;
//     }
//   }
// };

// WebScraperProcess.prototype.detachController = function(controllerInstance){

//   //instead of removing controller from array which is not thread safe
//   //mark the controller as down, if all controller down, then shutdown this process
//   for (var i = this.controllerStatusList.length - 1; i >= 0; i--) {
//     var controllerStatus = this.controllerStatusList[i];

//     if(controllerInstance === controllerStatus.controller){
//       controllerStatus.isUP = 0;
//     }
//   }

//   if(this.isOnDemandMode){
//     return;
//   }

//   if(this.getUpControllerCount() === 0){
//     this.down();
//   }
// };

// WebScraperProcess.prototype.getUpControllerCount = function(){
//   var upCount = 0;
//   for (var i = this.controllerStatusList.length - 1; i >= 0; i--) {
//     var controllerStatus = this.controllerStatusList[i];
//     if(controllerStatus.isUP === 1){
//       upCount++;
//     }
//   }
//   return upCount;
// };

WebScraperProcess.prototype.applyProcessGlobalSetting = function(){
  http.globalAgent.maxSockets = config.scraper.globalMaxSockets;
  //unlimit the Event Emitter
  process.setMaxListeners(0);
};

WebScraperProcess.prototype.up = function(){
    for (var i = this.controllerStatusList.length - 1; i >= 0; i--) {
      var controllerStatus = this.controllerStatusList[i];
      controllerStatus.controller.up();
      controllerStatus.isUP = 1;
    }
};

WebScraperProcess.prototype.down = function(){

  // if( this.jobProbingIntervalId !== null){
  //   clearInterval( this.jobProbingIntervalId );
  // }

  // if( this.pendingJobsProbingClient !== null){
  //   this.pendingJobsProbingClient.close();
  // }

  for (var i = this.controllerStatusList.length - 1; i >= 0; i--) {
      var controllerStatus = this.controllerStatusList[i];
      controllerStatus.controller.down();
  }
  process.exit(0);
};

module.exports = WebScraperProcess;
