/* jshint node: true, esnext:true */
'use strict';
var Promise     = require('bluebird');
var path        = require("path");
var fs          = Promise.promisifyAll(require("fs"));
var co          = require('co');
var request     = Promise.promisify(require('request'));
var url         = require('url');
var cheerio     = require('cheerio');
var Qs          = require('qs');
var jquery      = fs.readFileSync(require.resolve('jquery'), "utf-8");
var jsdom       = Promise.promisifyAll(require("jsdom"));
var BloomFilter = require('bloomfilter').BloomFilter;
var config      = rootRequire('config');
var URLRequest  = rootRequire('web_scraper/url_request');
var logger      = rootRequire('service/logger_manager');


function AbstractScrapHandler(urlRequest, services, domainConfig) {
  this.beanstalkdClient     = services.beanstalkdClient;
  this.mongodbClient        = services.mongodbClient;

  this.domainConfig         = domainConfig;

  this.currentUrlRequest    = urlRequest;

  //prepate for this._seenURL
  if(urlRequest.isPayloadExist("_seenURLBuckets")){
    this._seenURL             = new BloomFilter(urlRequest.getPayload("_seenURLBuckets"), 3);
  }else{
    this._seenURL             = new BloomFilter(8192, 16);
  }

  this._seenURL.add(urlRequest.url);
  //store bloomfilter's buckets as the payload
  var _seenURLBuckets       = [].slice.call(this._seenURL.buckets);
  this.currentUrlRequest.setPayload('_seenURLBuckets', _seenURLBuckets);

  this.domainConfigDetail   = this.domainConfig.getDomainConfigDetail(urlRequest.url);

  this.handleableURLPattern = this.getHandleableURLPattern();
}

AbstractScrapHandler.prototype.getHandleableURLPattern = function (){
    throw new Error('getHandleableURLPattern() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.scrap = co.wrap(function*($){
  throw new Error('scrap() is not implemented in ' + this.constructor.name);
});
//you can override this in subclass to assign specifc request's config
AbstractScrapHandler.prototype.getOverriddenRequestConfigBeforeRequest = function(currentUrlRequest){
  return null;
};

//if you like you can override it
AbstractScrapHandler.prototype.handle = co.wrap(function* (){

  var self = this;

  var overriddenRequestConfig = self.getOverriddenRequestConfigBeforeRequest(self.currentUrlRequest);

  var startTime = Date.now();

  var pageSource = yield this.requestPageSource(self.currentUrlRequest.url,null,overriddenRequestConfig);

  var duration = Date.now() - startTime;

  logger.debug("request Time: " + duration + "ms");

  if(this.handleableURLPattern instanceof RegExp){
    return yield self.scrap(pageSource, self.currentUrlRequest, self.domainConfig, self.domainConfigDetail);
  }else{
    for (var i = self.handleableURLPattern.length - 1; i >= 0; i--) {
      var patternMap = self.handleableURLPattern[i];
      if(patternMap.pattern.test(self.currentUrlRequest.url)){
        var scrapFunctionName = patternMap.scrapFunction;

        return yield self[scrapFunctionName](pageSource, self.currentUrlRequest, self.domainConfig, self.domainConfigDetail);
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

  if(this.domainConfig !== undefined && this.domainConfig !== null){
    var domainRequestConfig = yield this.domainConfig.getRequestConfig(url);
    this.extendJSON(requestConfig,domainRequestConfig);
  }

  if(overriddenRequestConfig !== undefined && overriddenRequestConfig !== null){
    this.extendJSON(requestConfig,overriddenRequestConfig);
  }

  //domain config callback
  if(this.domainConfig.onRequestStart !== undefined){
    this.domainConfig.onRequestStart(url,method,overriddenRequestConfig);
  }

  logger.debug("request:\n" + url);
  logger.debug(requestConfig);

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
  var href = anyHref;
  // case if anyHref is undefined, null, etc...
  if(!href){
      return undefined;
  }
  // case: href="  "
  var isURLBlank =  /^\s*$/.test(href);
  if(isURLBlank){
    return undefined;
  }

  // case: href="#", take out the hash value
  href = href.replace(/#(?!.*#)(.+?)$/g,"");



  return url.resolve(this.currentUrlRequest.url, href);
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

  logger.debug("found links contains " + string + ": ");
  logger.debug(res);

  return res;
};

AbstractScrapHandler.prototype.tryCrawlWithDepthReset = co.wrap(function*(href,payload,checkBloomFilter){
if(checkBloomFilter === undefined || checkBloomFilter === null || checkBloomFilter){
    checkBloomFilter = false;
  }

  logger.debug("try crawl with depth reset: " + href);

  var absolutePath = this.hrefToCrawlableAbsoluteURL(href);
  if(!absolutePath){
    logger.debug(href + " is not an crawlable absolute url");
    return;
  }

  yield this.__putNewResetDepthURLRequest(absolutePath,payload,checkBloomFilter);
});

AbstractScrapHandler.prototype.tryCrawlWithDepth = co.wrap(function*(href,payload,checkBloomFilter){
if(checkBloomFilter === undefined || checkBloomFilter === null || checkBloomFilter){
    checkBloomFilter = false;
  }

  logger.debug("try crawl with depth: " + href);

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
  if(checkBloomFilter === undefined || checkBloomFilter === null || checkBloomFilter){
    checkBloomFilter = false;
  }

  logger.debug("try crawl: " + href);

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


  yield this.__putNewURLRequest(absolutePath,payload,checkBloomFilter);
});

//if you are sure href must exist
AbstractScrapHandler.prototype.crawl = co.wrap(function*(href,payload,checkBloomFilter){
  checkBloomFilter = checkBloomFilter || true;

  logger.debug("crawl: " + href);

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

/**
 * save content into 'scraped_content' folder
 *
 * @param {string} filename
 * @param {string} content
 * @return {Promise}
 */
AbstractScrapHandler.prototype.saveText = co.wrap(function*(filename,content){
  var filepath = path.join(config.root,"scraped_content",filename);
  yield this.__writeFile(filepath, content);
});

/**
 * call trim() on every string or [string,...] in obj
 *
 * @param {string} obj
 */
AbstractScrapHandler.prototype.trimStringProperties = function(obj){
  var self = this;
  if (null === obj || "object" != typeof obj) return obj;
  for (var attr in obj) {
        if (!obj.hasOwnProperty(attr)) continue;

        var prop = obj[attr];

        if (Array.isArray(prop)){
          for (var i = prop.length - 1; i >= 0; i--) {
            var elm = prop[i];

            if (typeof elm != 'string') continue;
            prop[i] = elm.trim();
          }
        }

        if (typeof prop != 'string') continue;
        obj[attr] = prop.trim();
  }
};

/**
 * call trim() on every string or [string,...] in obj recursively
 *
 * @param {string} obj
 */
AbstractScrapHandler.prototype.trimStringPropertiesRecursively = function(obj){
  var self = this;
  if (null === obj || "object" != typeof obj) return obj;
  for (var attr in obj) {
        if (!obj.hasOwnProperty(attr)) continue;

        var prop = obj[attr];

        if (typeof prop == 'object'){
          self.trimStringPropertiesRecursively(prop);
        }

        if (Array.isArray(prop)){
          for (var i = prop.length - 1; i >= 0; i--) {
            var elm = prop[i];

            if (typeof elm == 'object'){
              self.trimStringPropertiesRecursively(elm);
            }

            if (typeof elm != 'string') continue;
            prop[i] = elm.trim();
          }
        }

        if (typeof prop != 'string') continue;
        obj[attr] = prop.trim();
  }
};

/**
 * test.com/?c=a%20of%20b#2 => "c=a%20of%20b"
 *
 * @param {string} url
 * @return {string|undefined}
 */
AbstractScrapHandler.prototype.extractQueryString = function(url){
  var queryString = /\?(?!.*\?)([^#]+)/g.exec(url);
  if(queryString === null){
    return undefined;
  }else{
    return queryString[1];
  }
};

AbstractScrapHandler.prototype.extractAwayQueryString = function(url){
  var extractedURL = /(.+)\?/g.exec(url);
  if(extractedURL === null){
    return undefined;
  }else{
    return extractedURL[1];
  }
};

AbstractScrapHandler.prototype.overrideQueryString = function(url,dictionary){
  var urlOnly = this.extractAwayQueryString(url);
  if(urlOnly === undefined){
    return undefined;
  }

  var queryString = this.QueryStringToObject(url);
  this.extendJSON(queryString,dictionary);
  var newURL = urlOnly + "?" + this.ObjectToQueryString(queryString);
  return newURL;
};

/**
 * test.com/?name=a%20b%20c => {name: "a b c"}
 *
 * @param {string} url
 * @return {object|undefined}
 */
AbstractScrapHandler.prototype.QueryStringToObject = function(url){
  // var urlParse = url.parse(url, true);
  // if(Object.keys(urlParse.query).length === 0 ){
  //   return undefined;
  // }
  // return urlParse.query;
  var queryString = this.extractQueryString(url);
  if(queryString === undefined){
    return undefined;
  }else{
    return Qs.parse(queryString);
  }
};

/**
 * return currentUrlRequest's queryString object
 *
 * @return {object|undefined}
 */
AbstractScrapHandler.prototype.getCurrentUrlRequestQueryStringObject = function(){
  return this.QueryStringToObject(this.currentUrlRequest.url);
};

/**
 * {name: "a b c"} => "name=a%20b%20c"
 *
 * @param {string} url
 * @return {string}
 */
AbstractScrapHandler.prototype.ObjectToQueryString = function(obj){
  return Qs.stringify(obj);
};

/**
 * test.com/#ab => "ab"
 *
 * @param {string} url
 * @return {string|undefined}
 */
AbstractScrapHandler.prototype.getHashTagValue = function(url){
  var res = /#(?!.*#)(.+?)$/g.exec(url);
  if( res === null){
    return undefined;
  }else{
    return res[1];
  }
};

/**
 * From Request doc: https://github.com/request/request#requestoptions-callback
 * when passed an object or a querystring, this sets body to a querystring representation of value,
 * and adds Content-type: application/x-www-form-urlencoded header.
 *
 * @param {object|string} object or query string as form body
 */
AbstractScrapHandler.prototype.buildFormRequestConfig = function(object){
  return {
      method : "POST",
      form : object
    };
};

/**
 * var a = {a:1}, b = {b:1}
 * extendJSON(a,b,...)
 * a => {a:1,b:1}
 *
 * @param {object} targetObject
 * @return {object} targetObject
 */
AbstractScrapHandler.prototype.extendJSON = function (target) {
    var sources = [].slice.call(arguments, 1);

    for (var i = sources.length - 1; i >= 0; i--) {
      var source = sources[i];
      for (var prop in source) {
            // if(source.hasOwnProperty(prop)){
            //   logger.debug(target.constructor.name + "."+prop+"="+target[prop]+" will be override by " + source.constructor.name + "." + prop +"="+source[prop]);
            // }
            target[prop] = source[prop];
        }
    }

    return target;
};

module.exports = Promise.promisifyAll(AbstractScrapHandler);
