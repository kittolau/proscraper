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

    var aClient = new BeanstalkdManager(config.beanstalkd,'yourTubename.jp');
    var aRequest = new URLRequest("http://www.google.com/en/");
    for (var i = 0; i < 1000; i++) {
      aClient.putURLRequest(aRequest);
    }
};

if (require.main === module) {
    main();
}
