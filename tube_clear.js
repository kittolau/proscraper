/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var co = require('co');
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");

var main = function(){

    var seedQueueClient = new BeanstalkdManager();
    co(function *(){
      while(true){
        yield seedQueueClient.consumeURLRequest();
      }
    }).catch(logger.error);

};

if (require.main === module) {
    main();
}