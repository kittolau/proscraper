/* jshint node: true, esnext:true */
'use strict';
var Promise              = require('bluebird');
var cheerio              = require('cheerio');
var co                   = require('co');
var inherits             = require('util').inherits;
var AbstractScrapHandler = rootRequire('web_scraper/abstract_scrap_handler');
var logger               = rootRequire('service/logger_manager');

//var constructor = function <contructor name>()
function ExampleHandler(services,domainConfig) {
  AbstractScrapHandler.call(this,services,domainConfig);
}
inherits(ExampleHandler, AbstractScrapHandler);

ExampleHandler.prototype.getHandleableURLPattern = function (){
  return /what-ever-site-you-want\.com\/hk\/(?:posts\/\d+|$)/g;
};

//if dont yield promise, then use  this.onError to catch error
ExampleHandler.prototype.handle = co.wrap(function*(urlRequest){
  var url        = urlRequest.url;
  var payload    = urlRequest.payload;
  var pageSource = yield this.getPageSource(url)
  .then(cheerio.load)
  .then(this.scrap.bind(this));
});

//test the code in chrome first
ExampleHandler.prototype.scrap = co.wrap(function*($){
  var self = this;
  var promises = [];

  //logger.debug("scrapping...");

  var nextPageUrl = $('a[title="next page"]').attr("href");
  if(typeof nextPageUrl !== 'undefined'){
    self.putURLRequest(nextPageUrl).catch(self.onError);
  }

  var trs = $('tr.white, tr.gray');
  trs.each(function(i, tr){
    var tds = $( tr ).children();

    var rawhostname = $(tds[0]).text();
    var rawcountry = $(tds[1]).text();
    var rawresponseTime = $(tds[2]).text();
    var rawanonymity = $(tds[3]).text();
    var rawproxyType = $(tds[6]).text();
    var rawcheckDate = $(tds[7]).text();

    if(rawcountry !== "CN" && rawcountry !== "TW" && rawcountry !== "HK" && rawcountry !== "JP"){
      return;
    }

    var hostname = rawhostname.trim();
    var ip =  hostname.split(':')[0].trim();
    var port =  hostname.split(':')[1].trim();
    var country = rawcountry.toLowerCase().trim();
    var responseTime = rawresponseTime.replace("s", "").trim();
    var anonymity = 0;
    var proxyType = rawproxyType.trim();
    var checkDate = rawcheckDate.trim();

    var data = {
      hostname : hostname,
      ip: ip,
      port: port,
      country : country,
      response_time : responseTime,
      anonymity : anonymity,
      proxy_type : proxyType,
      check_date : checkDate
    };

     self.mongodbClient
     .getPromisifiedCollection('web_proxys')
     .updateAsync({ip:ip}, data, {upsert:true}).catch(self.onError);
  });

  yield promises;
});

module.exports = ExampleHandler;
