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

  var self = this;

  this.domainConfigArray = this.__buildddomainConfigArray();
  //check integrity immediate after this.domainConfigArray is ready
}
inherits(DomainConfigLoader, Loader);

DomainConfigLoader.prototype.__buildddomainConfigArray = function (){
  var self = this;
  return new Promise(function(resolve,reject){

    var domainConfigArray = [];

    var handlersDir = path.join(__dirname, "scrap_handler");

    var files = self.recursiveGetfile(handlersDir);


    for (var i = files.length - 1; i >= 0; i--) {
      var filePath = files[i];


      var sourceCode = fs.readFileSync(filePath);


      var err = check(sourceCode, filePath);
      if (err) {
        console.log(err);
        throw new Error("syntax error detected while importing " + filePath);
      }


      var DomainConfigClass = require(filePath);

      var isAbstractDomainConfigSubclass = DomainConfigClass.prototype instanceof AbstractDomainConfig;
      if(!isAbstractDomainConfigSubclass){
        //skip
        continue;
      }
      domainConfigArray.push(new DomainConfigClass());

      logger.debug("Agent config loaded: " + filePath);
    }

    logger.debug("Agent config Loaded Completely");

    return resolve(domainConfigArray);
  });
};

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

DomainConfigLoader.prototype.findDomainConfigDetail = co.wrap(function*(domainNameIdentifier){
  var self = this;

  var domainConfigArray = yield self.domainConfigArray;




  for (var i = 0, len = domainConfigArray.length; i < len; i++) {
    var domainConfig = domainConfigArray[i];
    var domainConfigDetail = domainConfig.findDomainConfigDetail(domainNameIdentifier);
    if( domainConfigDetail !== undefined){
      return domainConfigDetail;
    }
  }
  return undefined;
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

