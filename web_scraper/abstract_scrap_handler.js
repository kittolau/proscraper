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


function AbstractScrapHandler(urlRequest, services, domainConfig) {
  this.beanstalkdClient  = services.beanstalkdClient;
  this.mongodbClient     = services.mongodbClient;

  this.domainConfig       = domainConfig;

  this.currentUrlRequest = urlRequest;

  //prepate for this._seenURL
  if(urlRequest.isPayloadExist("_seenURLBuckets")){
    this._seenURL = new BloomFilter(urlRequest.getPayload("_seenURLBuckets"), 3);
  }else{
    this._seenURL = new BloomFilter(8192, 16);
  }

  this._seenURL.add(urlRequest.url);
  //store bloomfilter's buckets as the payload
  var _seenURLBuckets = [].slice.call(this._seenURL.buckets);
  this.currentUrlRequest.setPayload('_seenURLBuckets', _seenURLBuckets);

  this.domainConfigDetail = this.domainConfig.getDomainConfigDetail(urlRequest.url);

  this.handleableURLPattern = this.getHandleableURLPattern();
}

AbstractScrapHandler.prototype.getHandleableURLPattern = function (){
    throw new Error('getHandleableURLPattern() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.scrap = co.wrap(function*($){
  throw new Error('scrap() is not implemented in ' + this.constructor.name);
});
//you can override this in subclass to assign specifc request's config
AbstractScrapHandler.prototype.getOverriddenRequestConfigBeforeRequest = function(){
  return null;
};

//if you like you can override it
AbstractScrapHandler.prototype.handle = co.wrap(function* (){
  var self = this;

  var overriddenRequestConfig = self.getOverriddenRequestConfigBeforeRequest();

  var startTime = Date.now();

  var pageSource              = yield this.requestPageSource(self.currentUrlRequest.url,null,overriddenRequestConfig);

  var duration = Date.now() - startTime;

  logger.debug("request Time: " + duration + "ms");

  if(this.handleableURLPattern instanceof RegExp){
    return yield self.scrap(pageSource);
  }else{
    for (var i = self.handleableURLPattern.length - 1; i >= 0; i--) {
      var patternMap = self.handleableURLPattern[i];
      if(patternMap.pattern.test(self.currentUrlRequest.url)){
        var scrapFunctionName = patternMap.scrapFunction;

        return yield self[scrapFunctionName](pageSource);
      }
    }
  }
});

AbstractScrapHandler.prototype.requestPageSource = co.wrap(function*(url, method, overriddenRequestConfig){
  method = method || "GET";

  var requestConfig = {
    url : url,
    method : method,
    followRedirect : true,
    maxRedirects: 10,
    timeout : config.scraper.default_request_timeout_seconds * 1000,
    //default to global agent
    agent : false
  };

  if(this.domainConfig !== undefined || this.domainConfig !== null){
    var domainRequestConfig = yield this.domainConfig.getRequestConfig(url);
    this.extendJSON(requestConfig,domainRequestConfig);
  }

  if(overriddenRequestConfig !== undefined || overriddenRequestConfig !== null){
    this.extendJSON(requestConfig,overriddenRequestConfig);
  }

  //domain config callback
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

  //domain config callback
  if(this.domainConfig.onRequestFinish !== undefined){
    this.domainConfig.onRequestFinish(url,method,overriddenRequestConfig);
  }

  return result[1];
});


//if the handle function dont yield promise, should use this function to capture error
AbstractScrapHandler.prototype.onNonYieldedError = function(err) {
  logger.error(err);
  logger.error(err.stack);
};


//you can override this in subclass to get the jquery implementation you like
AbstractScrapHandler.prototype.getCheerioPromise = co.wrap(function*(pageSource){
  return cheerio.load(pageSource);
});

//the loading time is about 3xxms, which is 1x time of cheerio
//use jquery when it is really needed
AbstractScrapHandler.prototype.getJqueryPromise = co.wrap(function*(pageSource){
  var window = yield jsdom.envAsync(
    pageSource,
    null,
    {src:[jquery]}
  );
  return window.$;
});


//this will help filter all invalid non crawlable url, only valid url will be returned
AbstractScrapHandler.prototype.hrefToCrawlableAbsoluteURL = function(anyHref){
  // case if anyHref is undefined, null, etc...
  if(!anyHref){
      return undefined;
  }
  // case: href="  "
  var isURLBlank =  /^\s*$/.test(anyHref);
  if(isURLBlank){
    return undefined;
  }

  // case: href="#"
  var isStartingWithHash = /^#.*/.test(anyHref);
  if(isStartingWithHash){
    return undefined;
  }

  return url.resolve(this.currentUrlRequest.url, anyHref);
};

AbstractScrapHandler.prototype.getAllLinksContains = function($, string){
  var self = this;

  var res = [];
  $('a').each(function(i,e){
    var absoluteURL = self.hrefToCrawlableAbsoluteURL($(e).attr('href'));
    if(absoluteURL === undefined){
      return;
    }
    if(absoluteURL.indexOf(string) > -1) {
      res.push(absoluteURL);
    }
  });

  return res;
};

AbstractScrapHandler.prototype.tryCrawlWithDepthReset = co.wrap(function*(href,payload,checkBloomFilter){
  checkBloomFilter = checkBloomFilter || true;

  var absolutePath = this.hrefToCrawlableAbsoluteURL(href);
  if(!absolutePath){
    logger.debug(href + " is not an crawlable absolute url");
    return;
  }

  yield this.__putNewResetDepthURLRequest(absolutePath,payload,checkBloomFilter);
});

AbstractScrapHandler.prototype.tryCrawlWithDepth = co.wrap(function*(href,payload,checkBloomFilter){
  checkBloomFilter = checkBloomFilter || true;

  var absolutePath = this.hrefToCrawlableAbsoluteURL(href);
  if(!absolutePath){
    logger.debug(href + " is not an crawlable absolute url");
    return;
  }

  if(this.domainConfigDetail.maximunDepthLevel !== null){
    if(this.currentUrlRequest.depthLevel >= this.domainConfigDetail.maximunDepthLevel ){
     logger.warn("maximun depth reached");
     return;
    }
  }

  yield this.__putNewDepthURLRequest(absolutePath,payload,checkBloomFilter);
});

AbstractScrapHandler.prototype.tryCrawl = co.wrap(function*(href,payload,checkBloomFilter){
  checkBloomFilter = checkBloomFilter || true;

  var absolutePath = this.hrefToCrawlableAbsoluteURL(href);
  if(!absolutePath){
    logger.debug(href + " is not an crawlable absolute url");
    return;
  }

  console.log(this.currentUrlRequest.depthLevel);
  console.log(this.domainConfigDetail.maximunDepthLevel);

  if(this.domainConfigDetail.maximunDepthLevel !== null){
    if(this.currentUrlRequest.depthLevel >= this.domainConfigDetail.maximunDepthLevel ){
     logger.warn("maximun depth reached");
     return;
    }
  }


  yield this.__putNewURLRequest(absolutePath,payload,checkBloomFilter);
});

//if you are sure href must exist
AbstractScrapHandler.prototype.crawl = co.wrap(function*(href,payload,checkBloomFilter){
  checkBloomFilter = checkBloomFilter || true;

  var absolutePath = this.hrefToCrawlableAbsoluteURL(href);
  if(!absolutePath){
    throw new Error(href + " is not a valid absolute url, cannot put in to job queue");
  }

  yield this.__putNewURLRequest(absolutePath,payload,checkBloomFilter);
});

AbstractScrapHandler.prototype.__putNewResetDepthURLRequest = co.wrap(function*(absolutePath,payload,checkBloomFilter){
  if(checkBloomFilter && this._seenURL.test(absolutePath)){
    logger.warn(absolutePath + " may has been visited before");
    return;
  }
  var urlRequest = URLRequest.prototype.__createNewCrawl(absolutePath,payload,this.currentUrlRequest);
  yield this.beanstalkdClient.putResetDepthURLRequest(urlRequest);
});

AbstractScrapHandler.prototype.__putNewDepthURLRequest = co.wrap(function*(absolutePath,payload,checkBloomFilter){
  if(checkBloomFilter && this._seenURL.test(absolutePath)){
    logger.warn(absolutePath + " may has been visited before");
    return;
  }
  var urlRequest = URLRequest.prototype.__createNewCrawl(absolutePath,payload,this.currentUrlRequest);
  yield this.beanstalkdClient.putDepthURLRequest(urlRequest);
});

AbstractScrapHandler.prototype.__putNewURLRequest = co.wrap(function*(absolutePath,payload,checkBloomFilter){
  if(checkBloomFilter && this._seenURL.test(absolutePath)){
    logger.warn(absolutePath + " may has been visited before");
    return;
  }
  var urlRequest = URLRequest.prototype.__createNewCrawl(absolutePath,payload,this.currentUrlRequest);
  yield this.beanstalkdClient.putURLRequest(urlRequest);
});


AbstractScrapHandler.prototype.__writeFile = co.wrap(function*(path,content){
  yield fs.writeFileAsync(path, content);
});

AbstractScrapHandler.prototype.saveText = co.wrap(function*(filename,content){
  var filepath = path.join(config.root,"scraped_content",filename);
  yield this.__writeFile(filepath, content);
});


AbstractScrapHandler.prototype.trimStringProperties = function(obj){
  if (null === obj || "object" != typeof obj) return obj;
  for (var attr in obj) {
        if (!obj.hasOwnProperty(attr)) continue;
        if(typeof obj[attr] != 'string') continue;
        obj[attr] = obj[attr].trim();
  }
};

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

module.exports = Promise.promisifyAll(AbstractScrapHandler);
