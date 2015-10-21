/* jshint node: true, esnext:true */
'use strict';
var config = rootRequire('config');

function URLRequest(url,payload,retryCount) {

  if(!this.isValidURI(url)){
    throw new Error(url + " does not match with either http://anything.anything or https://anything.anything");
  }

  payload          = payload || {};
  retryCount       = retryCount || 0;

  Object.defineProperty(this,'url',{value:url,enumerable:true});
  Object.defineProperty(this,'payload',{value:payload,configurable:true,enumerable:true});
  Object.defineProperty(this,'retryCount',{value:retryCount,enumerable:true});
}

URLRequest.prototype.isExccessDefaultRetryCount = function(){
  return this.retryCount >= config.scraper.retry_count;
};

URLRequest.prototype.isValidURI = function(url){
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

URLRequest.prototype.clonePayload = function(){
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

URLRequest.prototype.createNewURLRequestfromURLRequest = function(urlRequest){
  return new URLRequest(
    urlRequest.url,
    urlRequest.payload,
    urlRequest.retryCount
  );
};

URLRequest.prototype.createNewFailedURLRequestFromURLRequest = function(urlRequest){
  return new URLRequest(
    urlRequest.url,
    urlRequest.payload,
    urlRequest.retryCount + 1
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
