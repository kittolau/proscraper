/* jshint node: true, esnext:true */
//'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};

var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var config     = rootRequire('config');

var main = function(){

  function lookUpTubeStat(client){
    return client.stats_tubeAsync(config.beanstalkd.tube_name);
  }

  function clearConsole(){
    console.log('\033[2J');
  }

  var seedQueueClient = new BeanstalkdManager();
  var startTime = Date.now();

  setInterval(function() {
    seedQueueClient
    .clientPromise
    .then(lookUpTubeStat)
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
