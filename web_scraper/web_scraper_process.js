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

function WebScraperProcess(pid, numberOfController,controllerAllocationIDWhiteList){
  var self = this;

  self.pid                  = pid;
  self.controllerStatusList = [];
  self.numberOfController   = numberOfController;
  self.domainConfigLoader   = new DomainConfigLoader();
  self.AllocationWhiteList  = controllerAllocationIDWhiteList;
  self.allocatedList        = null;
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


WebScraperProcess.prototype.allocateController = co.wrap(function*(){
  var self = this;
  var loader = self.domainConfigLoader;
  var maxAllocatableController = self.numberOfController;

  logger.debug("process "+self.pid+" has "+ maxAllocatableController+ " qouta to allocate");

  yield loader.checkDomainNameIdentifierDuplicate();

  var requiredAllocationList = yield loader.getControllerAllocationList();
  var allocationWhiteList    = self.AllocationWhiteList;
  var allocatedList          = [];

  var totalAllocatedCount = 0;

  for (var i = requiredAllocationList.length - 1; i >= 0; i--) {
    var requiredAllocation = requiredAllocationList[i];

    var domainId = requiredAllocation.domainNameIdentifier;
    var numberOfRequiredController = requiredAllocation.requiredControllerCount;

    if(allocationWhiteList.indexOf(domainId) == -1){
      continue;
    }


    logger.debug("process "+self.pid+" allocating "+ numberOfRequiredController + " for "+ domainId);


    var domainConfigDetail = yield self.domainConfigLoader.findDomainConfigDetail(domainId);


    allocatedList.push(requiredAllocation);
    totalAllocatedCount += numberOfRequiredController;

    if(totalAllocatedCount > maxAllocatableController){
      throw new Error("White listed domain exceed the maximun "+ maxAllocatableController +" of controller:\n" + self.__getAllocationReportString(allocatedList));
    }

    for (var j = numberOfRequiredController - 1; j >= 0; j--) {
      var controller = new WebScraperController(
        self.pid,
        j,
        domainId,
        self.domainConfigLoader
      );
      var controllerStatus = {
        domainId : domainId,
        controller:controller,
        isUP : 0
      };
      self.controllerStatusList.push(controllerStatus);
    }
  }
  self.allocatedList = allocatedList;
  logger.debug("Web Scraper Process allocation:\n " + self.__getAllocationReportString(allocatedList));
  logger.debug("Web Scraper Process allocation qouta left:\n " + (maxAllocatableController - totalAllocatedCount));
});

WebScraperProcess.prototype.onSeriousError = function(err){
  logger.error(err);
  logger.error(err.stack);
  process.exit(1);
};

WebScraperProcess.prototype.__getAllocationReportString = function(allocatedList){
  return allocatedList.reduce(function (a, b) {
    return a + b.domainNameIdentifier + ": require " + b.requiredControllerCount + " controller(s)\n";
  },"");
};

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
  for (var i = this.controllerStatusList.length - 1; i >= 0; i--) {
      var controllerStatus = this.controllerStatusList[i];
      controllerStatus.controller.down();
  }
  process.exit(0);
};

module.exports = WebScraperProcess;
