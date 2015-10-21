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

    var aClient = new BeanstalkdManager(config.beanstalkd,'getproxy.jp');
    var bClient = new BeanstalkdManager(config.beanstalkd,'spys.ru');
    var cClient = new BeanstalkdManager(config.beanstalkd,'xroxy.com');
    var dClient = new BeanstalkdManager(config.beanstalkd,'gatherproxy.com');
    var aRequest = new URLRequest("http://www.getproxy.jp/en/");
    var bRequest = new URLRequest("http://spys.ru/");
    var cRequest = new URLRequest("http://www.xroxy.com/");
    var dRequest = new URLRequest("http://www.gatherproxy.com/");
    // for (var i = 0; i < 1000; i++) {
    //   aClient.putURLRequest(aRequest);

    //   bClient.putURLRequest(bRequest);

    //   cClient.putURLRequest(cRequest);

    //   dClient.putURLRequest(dRequest);
    // }
};

if (require.main === module) {
    main();
}
