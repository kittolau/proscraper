/* jshint node: true, esnext:true */
'use strict';
var Promise    = require('bluebird');
var path       = require("path");
var fs         = Promise.promisifyAll(require("fs"));
var co         = require('co');
var logger     = rootRequire('service/logger_manager');

function Loader() {}

Loader.prototype.recursiveGetfile = co.wrap(function* (directoryName){
  var paths = [];
  yield this.__recursiveGetfile(directoryName,paths);
  return paths;
});

Loader.prototype.__recursiveGetfile = function(directoryName, paths) {
  var self = this;

  return fs
  .readdirAsync(directoryName)
  .map(function(file){
    var fullPath   = path.join(directoryName,file);
    var resPromise = fs
    .statAsync(fullPath)
    .then(function(f) {
      if (f.isDirectory()) {
        return self.__recursiveGetfile(fullPath,paths);
      }
      paths.push(fullPath);
    })
    .catch(function(err){
      logger.error('Error: ', err);
      process.exit(1);
    });

    return resPromise;
  });
};

module.exports = Loader;
