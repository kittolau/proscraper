/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};

var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");

var main = function(){

    var seedQueueClient = new BeanstalkdManager();
    var urlRequest = new URLRequest("http://www.getproxy.jp/en/",'');
    for (var i = 0; i < 200; i++) {
      seedQueueClient.putURLRequest(urlRequest);
    }
};

if (require.main === module) {
    main();
}
