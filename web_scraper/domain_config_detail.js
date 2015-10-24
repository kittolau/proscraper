/* jshint node: true, esnext:true */
'use strict';
var config = rootRequire('config');
var URLRequestSeeder  = rootRequire("web_scraper/url_request_seeder");

function DomainConfigDetail(domainNameIdentifier, requiredControllerCountInProcess,maximunDepthLevel,agentSet,requestConfig, handleableDomainNamePatterns,seedURLs) {
  var self = this;

  var isValidDomainName = /^.+\..+/g.test(domainNameIdentifier);
  if(!isValidDomainName){
    throw new Error("domainNameIdentifier expects x.x string pattern, but given " + domainNameIdentifier);
  }
  if((!requiredControllerCountInProcess > 0) && requiredControllerCountInProcess !== null){
    throw new Error("requiredControllerCountInProcess expects > 1 or null, but given " + requiredControllerCountInProcess);
  }
  if((!maximunDepthLevel > 0) && maximunDepthLevel !== null){
    throw new Error("maximunDepthLevel expects > 1 or null, but given " + maximunDepthLevel);
  }
  if(typeof agentSet != 'object' && agentSet !== null){
    throw new Error("agentSet expects object or null, but given " + agentSet);
  }
  if(typeof requestConfig != 'object' && requestConfig !== null){
    throw new Error("requestConfig expects object or null, but given " + requestConfig);
  }
  var isValidArrayOfRegex =  Array.isArray(handleableDomainNamePatterns) && handleableDomainNamePatterns.every(function(elm){ return elm instanceof RegExp;} );
  if(!isValidArrayOfRegex){
    throw new Error("handleableDomainNamePatterns expects array of Regex, but given " + handleableDomainNamePatterns);
  }
  if(handleableDomainNamePatterns.length <= 0){
    throw new Error("handleableDomainNamePatterns expects at least one pattern");
  }

  if(!Array.isArray(seedURLs) && typeof seedURLs != 'string' && seedURLs !== null && seedURLs !== undefined){
    throw new Error("seedURLs expects array of url, url, null or undefined, but given " + seedURLs);
  }

  requiredControllerCountInProcess = requiredControllerCountInProcess || 1;

  Object.defineProperty(this,'domainNameIdentifier',{value:domainNameIdentifier,enumerable:true});
  Object.defineProperty(this,'requiredControllerCount',{value:requiredControllerCountInProcess,enumerable:true});
  Object.defineProperty(this,'maximunDepthLevel',{value:maximunDepthLevel,enumerable:true});
  Object.defineProperty(this,'agentSet',{value:agentSet,enumerable:true});
  Object.defineProperty(this,'requestConfig',{value:requestConfig,enumerable:true,configurable:true});
  Object.defineProperty(this,'handleableDomainNamePatterns',{value:handleableDomainNamePatterns,enumerable:true});

  if(Array.isArray(seedURLs) || typeof seedURLs == 'string'){
    Object.defineProperty(this,'seedURLs',{value:seedURLs,enumerable:true});
  }
}

DomainConfigDetail.prototype.lazySeedURLRequest = function(){
  var self = this;
  if(self.seedURLs === undefined){return;}

  if(self.urlRequestSeeder === undefined){
    self.urlRequestSeeder = new URLRequestSeeder(
      config.beanstalkd,
      self.domainNameIdentifier,
      self.seedURLs
    );
  }

  self.urlRequestSeeder.seed();
};

DomainConfigDetail.prototype.changeRequestConfig = function(newRequestConfig){
  Object.defineProperty(this,'requestConfig',{value:newRequestConfig});
};

DomainConfigDetail.prototype.__cloneRequestConfig = function(){
  if (null === this.requestConfig || "object" != typeof this.requestConfig) return this.requestConfig;
  var copy = this.requestConfig.constructor();
  for (var attr in this.requestConfig) {
      if (this.requestConfig.hasOwnProperty(attr)) copy[attr] = this.requestConfig[attr];
  }
  return copy;
};

DomainConfigDetail.prototype.getRequestConfig = function(url){
  var agent = this.__getAgent(url);
  var requestConfig = this.__cloneRequestConfig();
  if(!requestConfig){
    return {};
  }
  requestConfig.agent = agent;
  return requestConfig;
};

DomainConfigDetail.prototype.__getAgent = function(url){
  if(this.agentSet === null){
    return false;
  }
  if(url.match(/https:\/\//g)){
    return this.agentSet.httpsAgent;
  }else{
    return this.agentSet.httpAgent;
  }
};

DomainConfigDetail.prototype.canHandleURL = function(url) {
  for (var i = this.handleableDomainNamePatterns.length - 1; i >= 0; i--) {
    var pattern = this.handleableDomainNamePatterns[i];
    if(url.match(pattern)){
      return true;
    }
  }
  return false;
};



module.exports = DomainConfigDetail;
