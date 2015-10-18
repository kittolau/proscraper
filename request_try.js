/* jshint node: true, esnext:true */
'use strict';
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

    var seedQueueClient = new BeanstalkdManager();

    setInterval(function() {
        seedQueueClient
      .clientPromise
      .then(lookUpTubeStat)
      .then(console.log);
    }, 1000);
};

if (require.main === module) {
    main();
}
