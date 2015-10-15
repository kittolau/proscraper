/* jshint node: true, esnext:true */
'use strict';

function URLRequest(url,payload) {
  this.url     = url || '';
  this.payload = payload || '';
}

URLRequest.createfromURLRequest = function(urlRequest){
  var newURLRequest = new URLRequest();
  newURLRequest.url     = urlRequest.url;
  newURLRequest.payload = urlRequest.payload;
  return newURLRequest;
};

URLRequest.prototype.toString = function()
{
    return {'url':this.url, 'payload':this.payload};
};

module.exports = URLRequest;
