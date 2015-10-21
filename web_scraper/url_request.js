/* jshint node: true, esnext:true */
'use strict';
var config = rootRequire('config');

//to seed a job, create this by new URLRequest
function URLRequest(url,payload,retryCount, depthLevel) {

  if(!this.__isValidURI(url)){
    throw new Error(url + " does not match with either http://anything.anything or https://anything.anything");
  }

  payload    = payload || {};
  retryCount = retryCount || 0;
  depthLevel = depthLevel || 0;

  Object.defineProperty(this,'url',{value:url,enumerable:true});
  Object.defineProperty(this,'payload',{value:payload,configurable:true,enumerable:true});
  Object.defineProperty(this,'retryCount',{value:retryCount,enumerable:true});
  Object.defineProperty(this,'depthLevel',{value:depthLevel,enumerable:true});
}

URLRequest.prototype.isExccessDefaultRetryCount = function(){
  return this.retryCount >= config.scraper.retry_count;
};

URLRequest.prototype.__isValidURI = function(url){
  return /^http[s]?\:\/\/.+\..+/g.test(url);
};

URLRequest.prototype.setPayload = function(key,value){

  if(typeof value === 'undefined' || value === null){
    value = undefined;
  }

  var payload = this.payload;
  payload[key] = value;
  Object.defineProperty(this,'payload',{value:payload});
};

URLRequest.prototype.isPayloadExist = function(key){
  var isExist = typeof this.payload[key] != 'undefined';
  return isExist;
};

URLRequest.prototype.__clonePayload = function(){
  if (null === this.payload || "object" != typeof this.payload) return this.payload;
  var copy = this.payload.constructor();
  for (var attr in this.payload) {
      if (this.payload.hasOwnProperty(attr)) copy[attr] = this.payload[attr];
  }
  return copy;
};

URLRequest.prototype.getPayload = function(key){
  return this.payload[key];
};

URLRequest.prototype.mergePayload = function (target) {
    var sources = [].slice.call(arguments, 1);

    for (var i = sources.length - 1; i >= 0; i--) {
      var source = sources[i];
      for (var prop in source) {
            target[prop] = source[prop];
        }
    }

    return target;
};

URLRequest.prototype.__createNewCrawl = function(urlToCrawl,payloadToMerge,urlRequestToInherit){
  if(!this.__isValidURI(urlToCrawl)){
    throw new Error(urlToCrawl + " does not match with either http://anything.anything or https://anything.anything");
  }

  var margedPayload = urlRequestToInherit.__clonePayload();
  this.mergePayload(margedPayload, payloadToMerge);

  return new URLRequest(
    urlToCrawl,
    margedPayload,
    urlRequestToInherit.retryCount,
    urlRequestToInherit.depthLevel
  );
};

URLRequest.prototype.__createDeep = function(urlRequest){
  return new URLRequest(
    urlRequest.url,
    urlRequest.payload,
    urlRequest.retryCount,
    urlRequest.depthLevel + 1
  );
};

URLRequest.prototype.__createResetDepth = function(urlRequest){
  return new URLRequest(
    urlRequest.url,
    urlRequest.payload,
    urlRequest.retryCount,
    0
  );
};

URLRequest.prototype.__createNew = function(urlRequest){
  return new URLRequest(
    urlRequest.url,
    urlRequest.payload,
    urlRequest.retryCount,
    urlRequest.depthLevel
  );
};

URLRequest.prototype.__createNewFailed = function(urlRequest){
  return new URLRequest(
    urlRequest.url,
    urlRequest.payload,
    urlRequest.retryCount + 1,
    urlRequest.depthLevel
  );
};

URLRequest.prototype.toString = function()
{
    return {
      'url':this.url,
      'payload':this.payload,
      'retryCount' : this.retryCount
    };
};

module.exports = URLRequest;
