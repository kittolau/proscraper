/* jshint node: true, esnext:true */
'use strict';
var Promise     = require('bluebird');
var path        = require("path");
var fs          = Promise.promisifyAll(require("fs"));
var co          = require('co');
var request     = Promise.promisify(require('request'));
var url         = require('url');
var cheerio     = require('cheerio');
var jquery      = fs.readFileSync(require.resolve('jquery'), "utf-8");
var jsdom       = Promise.promisifyAll(require("jsdom"));
var BloomFilter = require('bloomfilter').BloomFilter;
var config      = rootRequire('config');
var URLRequest  = rootRequire('web_scraper/url_request');
var logger      = rootRequire('service/logger_manager');


function AbstractScrapHandler(services, domainConfig) {
  this.beanstalkdClient  = services.beanstalkdClient;
  this.mongodbClient     = services.mongodbClient;

  this.domainConfig       = domainConfig;
  this.currentUrlRequest  = null;
  this.bloomFilterSeenUrl = null;
  this.$                  = null;
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

AbstractScrapHandler.prototype.scrap = co.wrap(function*($){
  throw new Error('scrap() is not implemented in ' + this.constructor.name);
});
//you can override this in subclass to assign specifc request's config
AbstractScrapHandler.prototype.getOverriddenRequestConfigBeforeRequest = function(){
  return null;
};
//you can override this in subclass to get the jquery implementation you like
AbstractScrapHandler.prototype.getJqueryEngine = co.wrap(function*(pageSource){
  return cheerio.load(pageSource);

  // var window = yield jsdom.envAsync(pageSource,null,{src:[jquery]});
  // return window.$;
});

//if you like you can override it
AbstractScrapHandler.prototype.handle = co.wrap(function* (urlRequest){
  var self = this;

  //prepate for this.currentUrlRequest
  this.currentUrlRequest = urlRequest;
  var url        = urlRequest.url;
  var payload    = urlRequest.payload;

  //prepate for this.bloomFilterSeenUrl
  if(payload.bloomFilterSeenUrlArray === undefined){
    this.bloomFilterSeenUrl = new BloomFilter(8192, 16 );

    this.bloomFilterSeenUrl.add(url);
    //store bloomfilter's buckets as the payload
    var array = [].slice.call(this.bloomFilterSeenUrl.buckets);
    this.currentUrlRequest.payload.bloomFilterSeenUrlArray = array;
  }else{
    this.bloomFilterSeenUrl = new BloomFilter(payload.bloomFilterSeenUrlArray, 3);
  }

  //prepare for this.$
  var overriddenRequestConfig = self.getOverriddenRequestConfigBeforeRequest();
  var pageSource              = yield this.requestPageSource(url,null,overriddenRequestConfig);
  self.$                      = yield self.getJqueryEngine(pageSource);

  return yield self.scrap(self.$);
});

//if the handle function dont yield promise, should use this function to capture error
AbstractScrapHandler.prototype.onError = function(err) {
  logger.error(err);
  logger.error(err.stack);
};

AbstractScrapHandler.prototype.getLinkByCSS = function(selector){
  var self = this;
  var $    = self.$;

  var relativeURL = $(selector).attr("href");
  return self.__convertToAbsoluteURL(relativeURL);
};

AbstractScrapHandler.prototype.__convertToAbsoluteURL = function(relativeURL){
  if(relativeURL === undefined){
      return undefined;
  }
  return url.resolve(this.currentUrlRequest.url, relativeURL);
};

AbstractScrapHandler.prototype.getLinksContains = function(targetHostname){
  var self = this;
  var $    = self.$;

  var res = [];

  $('a').each(function(i,e){
    var relativeURL = $(e).attr('href');
    var absoluteURL = self.__convertToAbsoluteURL(relativeURL);
    if(absoluteURL === undefined){
      return;
    }
    var hostname = url.parse(absoluteURL).hostname;
    if(hostname === null){
      //if not a valid hostname
      return;
    }

    if(hostname.indexOf(targetHostname) > -1) {
      res.push(absoluteURL);
    }
  });

  return res;
};

AbstractScrapHandler.prototype.putURLRequest = co.wrap(function*(newUrl,payload,checkBloomFilter){
  checkBloomFilter = checkBloomFilter || true;

  var isURLBlank = !newUrl || /^\s*$/.test(newUrl);
  if(isURLBlank){
    throw new Error("cannot put empty URL in to job queue");
  }

  if(checkBloomFilter && this.bloomFilterSeenUrl.test(newUrl)){
    logger.info(newUrl + " may has been visited before");
    return;
  }

  var newPayload = this.currentUrlRequest.payload;
  this.extendJSON(newPayload,payload);

  var urlRequest = new URLRequest(newUrl,newPayload);
  yield this.beanstalkdClient.putURLRequest(urlRequest);
});


AbstractScrapHandler.prototype.__writeFile = co.wrap(function*(path,content){
  yield fs.writeFileAsync(path, content);
});

AbstractScrapHandler.prototype.saveText = co.wrap(function*(filename,content){
  var filepath = path.join(config.root,"scraped_content",filename);
  yield this.__writeFile(filepath, content);
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

AbstractScrapHandler.prototype.requestPageSource = co.wrap(function*(url, method, overriddenRequestConfig){

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
