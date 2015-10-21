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
  this.domainConfigArray = this.__buildddomainConfigArray();
  //check integrity immediate after this.domainConfigArray is ready
}
inherits(DomainConfigLoader, Loader);

DomainConfigLoader.prototype.__buildddomainConfigArray = co.wrap(function* (){
  var self = this;
  var domainConfigArray = [];

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
      var DomainConfigClass = require(filePath);
      var isAbstractDomainConfigSubclass = DomainConfigClass.prototype instanceof AbstractDomainConfig;
      if(!isAbstractDomainConfigSubclass){
        //skip
        return;
      }
      domainConfigArray.push(new DomainConfigClass());

      logger.debug("Agent config loaded: " + filePath);
    });
  });

  logger.debug("Agent config Loaded Completely");

  return domainConfigArray;
});

DomainConfigLoader.prototype.checkDomainNameIdentifierDuplicate =  co.wrap(function*(){
  var allocationList = yield this.getControllerAllocationList();

  var sorted_arr = allocationList.sort(function(a, b){
      if(a.domainNameIdentifier < b.domainNameIdentifier) return -1;
      if(a.domainNameIdentifier > b.domainNameIdentifier) return 1;
      return 0;
  });
  var dulplicatedResults = [];

  for (var i = 0; i < allocationList.length - 1; i++) {
      if (sorted_arr[i + 1].domainNameIdentifier == sorted_arr[i].domainNameIdentifier) {
          dulplicatedResults.push(sorted_arr[i].domainNameIdentifier);
      }
  }

  if(dulplicatedResults.length > 0){
    throw new Error("domain config id dulplication occur in " + dulplicatedResults.toString());
  }
});

DomainConfigLoader.prototype.getControllerAllocationList = co.wrap(function*(){
  var self = this;

  var domainConfigArray = yield self.domainConfigArray;

  var res = [];
  for (var i = 0, len = domainConfigArray.length; i < len; i++) {
    var domainConfig = domainConfigArray[i];
    res.push(domainConfig.getControllerAllocationList());
  }

  var merged = [].concat.apply([], res);
  return merged;
});

DomainConfigLoader.prototype.findConfigFor = co.wrap(function* (url){
  var self = this;

  if (!(typeof url === 'string' || url instanceof String)){
    throw new Error(url + " is not a string");
  }

  var domainConfigArray = yield self.domainConfigArray;

  for (var i = 0, len = domainConfigArray.length; i < len; i++) {
    var domainConfig = domainConfigArray[i];

    if(domainConfig.canHandleURL(url)){
      return domainConfig;
    }
  }

  logger.warn('No agent for '+ url + '');
});

module.exports = DomainConfigLoader;

