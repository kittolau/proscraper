/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var http               = require('http');
var Promise            = require('bluebird');
var os                 = require("os");
var cluster            = require('cluster');
var co                 = require('co');
var ScrapHandlerLoader = rootRequire("web_scraper/scrap_handler_loader");
var URLRequest         = rootRequire('web_scraper/url_request');
var logger             = rootRequire('service/logger_manager');
var BeanstalkdManager  = rootRequire("service/beanstalkd_manager");
var MongoManager       = rootRequire('service/mongo_manager');
var config             = rootRequire('config');
var async              = require('async')

function onSeriousError(err) {
  logger.error(err);
  logger.error(err.stack);
  process.exit(1);
}

function up_while_blocking(){
      var beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, 'testtube');

    co(function *(){
        while(true){
            var startTime = Date.now();

            //this is non blocking call
            // var urlRequest = yield beanstalkdClient.consumeURLRequest();


            var duration = Date.now() - startTime;

            console.log("Controller blocking used "+duration+"ms to complete job");
        }
    })
    .catch(onSeriousError);
}

function up_while_timeout(timeout){
      var beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, 'testtube');

      var promgram_startime= Date.now();
      var startTime
    co(function *(){
        while(true){

          console.log("up_while_timeout started a jobs")
          startTime = Date.now();

          try{
            //this is non blocking call
            // var urlRequest = yield beanstalkdClient.consumeURLRequestWithTimeout(timeout);

          }catch(err){
            var duration = Date.now() - startTime;
            console.log(Date.now() - promgram_startime+ "up_while_timeout used "+duration+"ms to complete job");
          }
        }
    })
    .catch(function(){
      var duration = Date.now() - startTime;
      console.log("up_while_timeout used "+duration+"ms to complete job");
    });
}

function up_setinterval_timeout(){
      var beanstalkdClient   = new BeanstalkdManager(config.beanstalkd, 'testtube');

    setInterval(function(){

      console.log("up_setinterval_timeout started a jobs")
      var startTime = Date.now();

      beanstalkdClient.consumeURLRequestWithTimeout(3)
      .then(function(){
        console.log()
      })
      .catch(function(){
        var duration = Date.now() - startTime;

        console.log("up_setinterval_timeout used "+duration+"ms to complete job");
      });
    },1000);
}

up_while_blocking();
up_while_blocking();
up_while_timeout(1);
up_while_timeout(10);
up_while_timeout(1);
up_while_timeout(1);
up_while_timeout(1);
up_while_timeout(1);
up_while_timeout(1);
up_while_timeout(1);
up_while_timeout(1);
//up_setinterval_timeout();
