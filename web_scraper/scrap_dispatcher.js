/* jshint node: true, esnext:true */
'use strict';
var path    = require("path");
var co      = require('co');
var Promise = require("bluebird");
var check   = require('syntax-error');
var fs      = Promise.promisifyAll(require("fs"));
var logger  = rootRequire('service/logger_manager');

function ScrapDispatcher() {
  this.scrapHandlers        = [];
  this.isScrapHandlersReady = false;
}

ScrapDispatcher.prototype.getScrapHandlers = function(){
  var self = this;

  if(self.isScrapHandlersReady){
    return Promise.resolve(self.scrapHandlers);
  }

  var handlersDir = path.join(__dirname, "scrap_handler");
  var resPromise  = self.recursiveGetfile(handlersDir)
    .then(function(files){

      function importHandler(sourceCode){
        var sourceCodeFilePath = this.sourceCodeFilePath;
        var err = check(sourceCode, sourceCodeFilePath);
        if (err) {
            console.log(err);
            throw new Error("syntax error detected while importing " + sourceCodeFilePath);
        }

        var HandlerClass     = require(sourceCodeFilePath);
        var urlPattern       = HandlerClass.getHandleableURLPattern();
        self.scrapHandlers.push({'urlPattern':urlPattern, 'handlerClass':HandlerClass});

        logger.debug("Handler loaded: " + sourceCodeFilePath);
      }

      var allFilePromise = [];
      for (var i = 0; i < files.length; ++i) {
        var scrapHandlerPath = files[i];
        var filePromise = fs.readFileAsync(scrapHandlerPath)
          .then(importHandler.bind({sourceCodeFilePath:scrapHandlerPath}));

        allFilePromise.push(filePromise);
      }

      return Promise.all(allFilePromise);
    })
    .then(function(){
      self.isScrapHandlersReady = true;
      return self.scrapHandlers;
    });

  return resPromise;
};

ScrapDispatcher.prototype.recursiveGetfile = co.wrap(function* (directoryName){
  var paths = [];
  yield this.__recursiveGetfile(directoryName,paths);
  return paths;
});

ScrapDispatcher.prototype.__recursiveGetfile = co.wrap(function* (directoryName, paths) {
  var self = this;

  yield fs.readdirAsync(directoryName)
    .map(function(file){
      var fullPath   = path.join(directoryName,file);

      var resPromise = fs.statAsync(fullPath)
        .then(function(f) {

          if (f.isDirectory()) {
            return self.__recursiveGetfile(fullPath,paths);
          }

          paths.push(fullPath);
        })
        .catch(function(err){
          logger.error('Error: ', err);
          process.exit();
        });
      return resPromise;
    });
});

ScrapDispatcher.prototype.getHandlerClassFor = co.wrap(function* (url){
  var self = this;

  if (!(typeof url === 'string' || url instanceof String)){
    throw new Error(url + " is not a string");
  }

  var scrapHandlers = yield self.getScrapHandlers();

  for (var i = 0, len = scrapHandlers.length; i < len; i++) {
    var handlerMap = scrapHandlers[i];

    var urlPattern = handlerMap.urlPattern;
    var handlerClass = handlerMap.handlerClass;

    if(url.match(urlPattern)){
      return handlerClass;
    }
  }
  throw new Error('No handlerClass can handles '+ url);
});

module.exports = ScrapDispatcher;

