/* jshint node: true, esnext:true */
'use strict';
var Promise    = require('bluebird');
var path       = require("path");
var fs         = Promise.promisifyAll(require("fs"));
var co         = require('co');
var request    = Promise.promisify(require('request'));
var config     = rootRequire('config');
var URLRequest = rootRequire('web_scraper/url_request');
var logger     = rootRequire('service/logger_manager');

function AbstractScrapHandler(services, domainConfig) {
  this.beanstalkdClient = services.beanstalkdClient;
  this.mongodbClient    = services.mongodbClient;

  this.domainConfig     = domainConfig;
}

AbstractScrapHandler.prototype.getHandleableURLPattern = function (){
    throw new Error('getHandleableURLPattern() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.getHostname = function (){
  throw new Error('getHostname() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.maxConnection = function (){
  throw new Error('maxConnection() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.handle = function (urlRequest){
    throw new Error('handle() is not implemented in ' + this.constructor.name);
};

//if the handle function dont yield promise, should use this function to capture error
AbstractScrapHandler.prototype.onError = function(err) {
  logger.error(err);
  logger.error(err.stack);
};

AbstractScrapHandler.prototype.putURLRequest = co.wrap(function*(nextPageUrl,payload){

  var isURLBlank = !nextPageUrl || /^\s*$/.test(nextPageUrl);
  if(isURLBlank){
    throw new Error("cannot put empty URL in to job queue");
  }

  var urlRequest = new URLRequest(nextPageUrl,payload);
  yield this.beanstalkdClient.putURLRequest(urlRequest);
});


AbstractScrapHandler.prototype.writeFile = co.wrap(function*(path,content){
  yield fs.writeFileAsync(path, content);
});

AbstractScrapHandler.prototype.saveText = co.wrap(function*(filename,content){
  var filepath = path.join(config.root,"scraped_content",filename);
  yield this.writeFile(filepath, content);
});

AbstractScrapHandler.prototype.extendJSON = function (target) {
    var sources = [].slice.call(arguments, 1);

    for (var i = sources.length - 1; i >= 0; i--) {
      var source = sources[i];
      for (var prop in source) {
            target[prop] = source[prop];
        }
    }

    return target;
};

AbstractScrapHandler.prototype.getPageSource = co.wrap(function*(url, method, overriddenRequestConfig){

  method = method || "GET";

  var requestConfig = {
    url : url,
    method : method,
    followRedirect : true,
    maxRedirects: 10,
    timeout : 10000,
    agent : false
  };

  if(this.domainConfig !== undefined || this.domainConfig !== null){
    var domainRequestConfig = yield this.domainConfig.getRequestConfig(url);
    this.extendJSON(requestConfig,domainRequestConfig);
  }

  if(overriddenRequestConfig !== undefined || overriddenRequestConfig !== null){
    this.extendJSON(requestConfig,overriddenRequestConfig);
  }

  if(this.domainConfig.onRequestStart !== undefined){
    this.domainConfig.onRequestStart(url,method,overriddenRequestConfig);
  }

  var result = yield request(requestConfig)
  .catch(function(err){

    var errCode = err.code;

    if(err.code === 'ETIMEDOUT'){
      if(err.connect === true){

        //connection timeout
        errCode += '_CONNECTION' ;
        throw new Error("Connection timeout: " + url);
      }else{

        //read timout Or others
        errCode += '_READ' ;
        throw new Error("Read timeout: " + url);
      }
    }else if(err.code === 'ECONNRESET'){

      //Connection reset by peer
      throw new Error("Connection reset by peer: " + url);
    }else if(err.code === 'ECONNREFUSED'){

      //Connection refused by target machine actively
      throw new Error("Connection refused: " + url);
    }else{
      throw new Error("Unknown error: " + err);
    }

    if(this.domainConfig.onRequestERR !== undefined){
    this.domainConfig.onRequestERR(url,errCode);
  }
  });

  if(this.domainConfig.onRequestFinish !== undefined){
    this.domainConfig.onRequestFinish(url,method,overriddenRequestConfig);
  }

  return result[1];
});

module.exports = Promise.promisifyAll(AbstractScrapHandler);
