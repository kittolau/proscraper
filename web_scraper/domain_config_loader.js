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


function DomainConfigLoader() {
  Loader.call(this);

  this.domainConfigMappings = this.__builddDomainConfigMappings();
}
inherits(DomainConfigLoader, Loader);

DomainConfigLoader.prototype.__builddDomainConfigMappings = co.wrap(function* (){
  var self = this;
  var domainConfigMappings = [];

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
      var DomainConfigClass         = require(filePath);
      var isAbstractDomainConfigSubclass = DomainConfigClass.prototype instanceof AbstractDomainConfig;
      if(!isAbstractDomainConfigSubclass){
        //skip
        return;
      }

      var hostnamePatternArray           = DomainConfigClass.prototype.getHandleableHostnamePatternArray();

      var isValidPatternArray = Array.isArray(hostnamePatternArray) && hostnamePatternArray.every(function(elm){ return elm instanceof RegExp;} );
      if(!isValidPatternArray){
        throw new Error("DomainConfigClass.getHandleablehostnamePatternArray is not an array of RegExp in " + filePath);
      }

      var domainConfigInstance = new DomainConfigClass();

      for (var i = hostnamePatternArray.length - 1; i >= 0; i--) {
        var hostnamePattern = hostnamePatternArray[i];

          domainConfigMappings.push({'hostnamePattern':hostnamePattern, 'domainConfigInstance':domainConfigInstance});

      }

      logger.debug("Agent config loaded: " + filePath);
    });
  });

  logger.debug("Agent config Loaded Completely");

  return domainConfigMappings;
});

DomainConfigLoader.prototype.findConfigFor = co.wrap(function* (url){
  var self = this;

  if (!(typeof url === 'string' || url instanceof String)){
    throw new Error(url + " is not a string");
  }

  var domainConfigMappings = yield self.domainConfigMappings;

  for (var i = 0, len = domainConfigMappings.length; i < len; i++) {
    var domainConfigMap = domainConfigMappings[i];

    var hostnamePattern = domainConfigMap.hostnamePattern;
    var domainConfigInstance = domainConfigMap.domainConfigInstance;

    if(url.match(hostnamePattern)){
      return domainConfigInstance;
    }
  }

  logger.warn('No agent for '+ url + '');
});

module.exports = DomainConfigLoader;

