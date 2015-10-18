/* jshint node: true, esnext:true */
var http              = require('http');
var os                = require("os");
var cluster           = require('cluster');
var co                = require('co');
var WebScraperController   = rootRequire("web_scraper/web_scraper_controller");
var AgentConfigLoader   = rootRequire("web_scraper/agent_config_loader");
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var MongoManager      = rootRequire('service/mongo_manager');
var config     = rootRequire('config');

function WebScraperProcess(pid, numberOfController){
  var self = this;
  this.pid = pid;
  this.controllerList = [];
  this.agentConfigLoader = new AgentConfigLoader();

  for (var i = numberOfController - 1; i >= 0; i--) {
    var controller = new WebScraperController(this.pid, i, this.agentConfigLoader);
    this.controllerList.push(controller);
  }
}

WebScraperProcess.prototype.applyProcessGlobalSetting = function(){
  http.globalAgent.maxSockets = config.scraper.globalMaxSockets;
  //unlimit the Event Emitter
  process.setMaxListeners(0);
};

WebScraperProcess.prototype.up = function(){
    for (var i = this.controllerList.length - 1; i >= 0; i--) {
      this.controllerList[i].up();
    }
};

WebScraperProcess.prototype.down = function(){
  for (var i = this.controllerList.length - 1; i >= 0; i--) {
      this.controllerList[i].down();
  }
};

module.exports = WebScraperProcess;
