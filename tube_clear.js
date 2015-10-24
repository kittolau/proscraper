/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var co                = require('co');
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var config            = rootRequire('config');

var main = function(){

    var DOMAIN_ID = 'gatherproxy.com';

    var seedQueueClient = new BeanstalkdManager(config.beanstalkd,DOMAIN_ID);
    co(function *(){
      while(true){
        var job = yield seedQueueClient.consumeURLRequestWithTimeout(1);

        console.log(job)

        if(!job){
          break;
        }
      }

      console.log('aaaaaaa')

    }).catch(logger.error);

};

if (require.main === module) {
    main();
}
