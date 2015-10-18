/* jshint node: true, esnext:true */
'use strict';
var co = require('co');

function AbstractDomainConfig() {}

AbstractDomainConfig.prototype.getHandleableHostnamePatternArray = function (){
    throw new Error('getHandleableHostnamePatternArray() is not implemented in ' + this.constructor.name);
};

AbstractDomainConfig.prototype.getRequestConfig = co.wrap(function* (uri){
    throw new Error('getRequestConfig() is not implemented in ' + this.constructor.name);
});

AbstractDomainConfig.prototype.isHTTPS = function(uri){
  return uri.match(/https:\/\//g);
}

module.exports = AbstractDomainConfig;
