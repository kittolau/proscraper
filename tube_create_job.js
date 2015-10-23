/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};

var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var config            = rootRequire('config');

var main = function(){

    var SEED_URL = "http://www.gatherproxy.com/proxylist/country/?c=Hong%20Kong";
    var DOMAIN_ID = 'gatherproxy.com';

    var aClient = new BeanstalkdManager(config.beanstalkd,DOMAIN_ID);
    var aRequest = new URLRequest(SEED_URL);
    for (var i = 0; i < 1; i++) {
      aClient.putURLRequest(aRequest);
    }
};

if (require.main === module) {
    main();
}
