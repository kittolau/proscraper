/* jshint node: true */
'use strict';
var path = require('path');
var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');
var config = rootRequire('config');

function LoggerManager() {}

LoggerManager.loggerInstance = null;

LoggerManager.prototype.getInstance = function () {
  // Lazy load the bunyan package.
  if (!LoggerManager.loggerInstance) {
    LoggerManager.loggerInstance = this.__buildLogger();
  }
  return LoggerManager.loggerInstance;
};

LoggerManager.prototype.__buildLogger = function(){
  var streams = [];
  if(config.logger.hasOwnProperty("file_log")){

    var filename =  "pid_" + process.pid + "_"+ config.logger.file_log.filename;

    streams.push({
      level: config.logger.file_log.level,
      path: path.join(config.root,'log',filename)
    });
  }
  if(config.logger.hasOwnProperty("stdout_log")){
    var prettyStdOut = new PrettyStream();
    prettyStdOut.pipe(process.stdout);

    streams.push({
      level: config.logger.stdout_log.level,
      stream: prettyStdOut //process.stdout
    });
  }

  var logger = bunyan.createLogger({
    src: true,
    name: config.logger.name,
    streams: streams
  });

  return logger;
};

module.exports = new LoggerManager().getInstance();
