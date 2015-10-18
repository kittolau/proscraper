/* jshint node: true, esnext:true */
'use strict';
var path                 = require("path");
var co                   = require('co');
var Promise              = require("bluebird");
var check                = require('syntax-error');
var inherits             = require('util').inherits;
var fs                   = Promise.promisifyAll(require("fs"));
var logger               = rootRequire('service/logger_manager');
var http                 = require('http');
var Loader               = rootRequire('web_scraper/loader');
var AbstractDomainConfig = rootRequire('web_scraper/abstract_domain_config');


function AgentLoader() {
  Loader.call(this);

  this.agentMappings = this.__bliudAgentMappings();
}
inherits(AgentLoader, Loader);

AgentLoader.prototype.__bliudAgentMappings = co.wrap(function* (){
  var self = this;
  var agentMappings = [];

  var handlersDir = path.join(__dirname, "scrap_handler");
  var files = yield this.recursiveGetfile(handlersDir);

  yield files.map(function(filePath){
    return fs
    .readFileAsync(filePath)
    .then(function(sourceCode){
      var err = check(sourceCode, filePath);
      if (err) {
        console.log(err);
        throw new Error("syntax error detected while importing " + filePath);
      }
    })
    .then(function(){
      var AgentConfigClass         = require(filePath);
      var isAbstractDomainConfigSubclass = AgentConfigClass.prototype instanceof AbstractDomainConfig;
      if(!isAbstractDomainConfigSubclass){
        //skip
        return;
      }
      var mappingList = AgentConfigClass.prototype.getAgentMappingsList();

      for (var i = mappingList.length - 1; i >= 0; i--) {
        var mapping = mappingList[i];
        var hostnamePatterns = mapping.hostnamePatterns;
        var agentInstance = mapping.agent;

        var isValidHostnamePatterns = Array.isArray(hostnamePatterns) && hostnamePatterns.every(function(elm){ return elm instanceof RegExp;} );
        if(!isValidHostnamePatterns){
          throw new Error("mapping.hostnamePatterns is not an array of RegExp in " + filePath);
        }

        var isAgent = agentInstance instanceof http.Agent;
        if(!isAgent){
          throw new Error("mapping.agent is not an instance of http.Agent in " + filePath);
        }

        for (var j = hostnamePatterns.length - 1; j >= 0; j--) {
          var hostnamePattern = hostnamePatterns[i];

          agentMappings.push({'hostnamePattern':hostnamePattern, 'agentInstance':agentInstance});
        }
      }

      logger.debug("Agent config loaded: " + filePath);
    });
  });

  logger.debug("Agent config Loaded Completely");

  return agentMappings;
});

AgentLoader.prototype.findAgentFor = co.wrap(function* (url){
  var self = this;

  if (!(typeof url === 'string' || url instanceof String)){
    throw new Error(url + " is not a string");
  }

  var agentMappings = yield self.agentMappings;

  for (var i = 0, len = agentMappings.length; i < len; i++) {
    var handlerMap = agentMappings[i];

    var hostnamePattern = handlerMap.hostnamePattern;
    var agentInstance = handlerMap.agentInstance;

    if(url.match(hostnamePattern)){
      return agentInstance;
    }
  }

  logger.warn('No agent for '+ url + '');
});

module.exports = AgentLoader;

