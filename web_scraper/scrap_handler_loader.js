/* jshint node: true, esnext:true */
'use strict';
var path                 = require("path");
var co                   = require('co');
var Promise              = require("bluebird");
var check                = require('syntax-error');
var inherits             = require('util').inherits;
var fs                   = Promise.promisifyAll(require("fs"));
var logger               = rootRequire('service/logger_manager');
var http                 = require('http');
var Loader               = rootRequire('web_scraper/loader');
var AbstractScrapHandler = rootRequire('web_scraper/abstract_scrap_handler');

function ScrapHandlerLoader() {
  Loader.call(this);

  this.scrapHandlers = this.__bliudScrapHandlersPromise();
}
inherits(ScrapHandlerLoader, Loader);

ScrapHandlerLoader.prototype.__bliudScrapHandlersPromise = co.wrap(function* (){
  var self = this;
  var handlers = [];

  var handlersDir = path.join(__dirname, "scrap_handler");
  var files = yield this.recursiveGetfile(handlersDir);
  yield files.map(function(scrapHandlerPath){
    return fs
    .readFileAsync(scrapHandlerPath)
    .then(function(sourceCode){
      var err = check(sourceCode, scrapHandlerPath);
      if (err) {
        console.log(err);
        throw new Error("syntax error detected while importing " + scrapHandlerPath);
      }
    })
    .then(function(){
      var HandlerClass         = require(scrapHandlerPath);
      var isAbstractScrapHandlerSubclass = HandlerClass.prototype instanceof AbstractScrapHandler;
      if(!isAbstractScrapHandlerSubclass){
        //skip
        return;
      }

      var urlPattern           = HandlerClass.prototype.getHandleableURLPattern();

      if(urlPattern instanceof RegExp){
        //if it is a regex object
        handlers.push({'urlPattern':urlPattern, 'handlerClass':HandlerClass});

      }else if(Array.isArray(urlPattern)){
        for (var i = urlPattern.length - 1; i >= 0; i--) {
          if(urlPattern[i].pattern === undefined){
            throw new Error("getHandleableURLPattern() returns object does not contain 'pattern' property");
          }

          if(!urlPattern[i].pattern instanceof RegExp){
            throw new Error("getHandleableURLPattern() returns object.pattern is not Regex");
          }

          if(urlPattern[i].scrapFunction === undefined){
            throw new Error("getHandleableURLPattern() returns object does not contain 'scrapFunction' property");
          }

          if(typeof urlPattern[i].scrapFunction != 'string'){
            throw new Error("getHandleableURLPattern() returns object.scrapFunction is not string");
          }

          if(/^$.+/g.test(urlPattern[i].scrapFunction)){
            throw new Error("getHandleableURLPattern() returns object.scrapFunction is not mathcing pattern /$.+/g");
          }

          if(typeof HandlerClass.prototype[urlPattern[i].scrapFunction] != 'function'){
            throw new Error(HandlerClass.constructor.name + " does not have function " + urlPattern[i].scrapFunction);
          }

          handlers.push({'urlPattern':urlPattern[i].pattern, 'handlerClass':HandlerClass});
        }
      }else{
        throw new Error("expected getHandleableURLPattern() return Regex or {pattern,scrapFunction}, but given " + urlPattern);
      }

      logger.debug("Handler loaded: " + scrapHandlerPath);
    });
  });

  return handlers;
});

ScrapHandlerLoader.prototype.getHandlerClassFor = co.wrap(function* (url){
  var self = this;

  if (!(typeof url === 'string' || url instanceof String)){
    throw new Error(url + " is not a string");
  }

  var scrapHandlers = yield self.scrapHandlers;

  for (var i = 0, len = scrapHandlers.length; i < len; i++) {
    var handlerMap = scrapHandlers[i];

    var urlPattern = handlerMap.urlPattern;
    var handlerClass = handlerMap.handlerClass;

    if(url.match(urlPattern)){
      return handlerClass;
    }
  }

  logger.warn('No handler Class can handles '+ url);
});

module.exports = ScrapHandlerLoader;

