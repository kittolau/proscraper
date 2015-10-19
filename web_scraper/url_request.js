/* jshint node: true, esnext:true */
'use strict';

function URLRequest(url,payload) {
  this.url     = url || '';
  this.payload = payload || {};
  this.retryCount = 0;
}

URLRequest.createfromURLRequest = function(urlRequest){
  var newURLRequest = new URLRequest();
  newURLRequest.url     = urlRequest.url;
  newURLRequest.payload = urlRequest.payload;
  newURLRequest.retryCount = urlRequest.retryCount;
  return newURLRequest;
};

URLRequest.createFromFailedURLRequest = function(urlRequest){
  var newURLRequest = new URLRequest();
  newURLRequest.url     = urlRequest.url;
  newURLRequest.payload = urlRequest.payload;
  newURLRequest.retryCount = urlRequest.retryCount + 1;
  return newURLRequest;
};

URLRequest.prototype.getRetryCount = function(){
  return this.retryCount;
};

URLRequest.prototype.toString = function()
{
    return {'url':this.url, 'payload':this.payload};
};

module.exports = URLRequest;
