/* jshint node: true, esnext:true */
//'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};

var Promise           = require('bluebird');
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var config            = rootRequire('config');

var main = function(){

  var allDomainId = ["getproxy.jp",'gatherproxy.com','xroxy.com'];

  function clearConsole(){
    console.log('\033[2J');
  }

  var allTube = [];
  for (var i = allDomainId.length - 1; i >= 0; i--) {
    var tube = allDomainId[i];
    allTube.push(new BeanstalkdManager(config.beanstalkd,tube));
  }


  var startTime = Date.now();

  setInterval(function() {
    Promise
    .all(allTube)
    .map(function(c){
      return c.lookUpTubeStat();
    })
    .then(function(s){
      clearConsole();
      return s;
    })
    .then(console.log)
    .then(function(){
      var duration = Date.now() - startTime;
      console.log("Duration: " + duration+"ms");
    });
  }, 1000);
};

if (require.main === module) {
    main();
}
