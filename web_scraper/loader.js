/* jshint node: true, esnext:true */
'use strict';
var Promise    = require('bluebird');
var path       = require("path");
var fs         = Promise.promisifyAll(require("fs"));
var co         = require('co');
var logger     = rootRequire('service/logger_manager');

function Loader() {}

Loader.prototype.recursiveGetfile = function (directoryName){
  var paths = [];
  this.__recursiveGetfile(directoryName,paths);
  return paths;
};

Loader.prototype.__recursiveGetfile = function(directoryName, paths) {
  var self = this;

  var files = fs.readdirSync(directoryName);
  for (var i = files.length - 1; i >= 0; i--) {
    var file = files[i];
    var fullPath   = path.join(directoryName,file);

    var f = fs.statSync(fullPath);
    if (f.isDirectory()) {
      self.__recursiveGetfile(fullPath,paths);
    }else{
      paths.push(fullPath);
    }
  }
  return;
};

module.exports = Loader;
