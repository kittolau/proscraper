/* jshint node: true, esnext:true */
'use strict';
var Promise              = require('bluebird');
var co                   = require('co');
var inherits             = require('util').inherits;
var AbstractScrapHandler = rootRequire('web_scraper/abstract_scrap_handler');
var logger               = rootRequire('service/logger_manager');
var url                  = require('url');

function ScrapHandler(urlRequest, services, domainConfig) {
  AbstractScrapHandler.call(this,urlRequest, services, domainConfig);
}
inherits(ScrapHandler, AbstractScrapHandler);


// ScrapHandler.prototype.getHandleableURLPattern = function (){
//   return [
//     {
//       'pattern': /whatever-you-want\.com\/posts\//g,
//       'scrapFunction': '$scrapPosts',
//     },
//     {
//       'pattern': /whatever-you-want\.com\/users\//g,
//       'scrapFunction': '$scrapUsers',
//     },
//   ];
// };

// ScrapHandler.prototype.$scrapUsers = co.wrap(function*(pageSource){
//   var self = this;
//   var blockingPromises = [];
//   var $ = yield self.getCheerioPromise(pageSource);
// });

// ScrapHandler.prototype.$scrapPosts = co.wrap(function*(pageSource){
//   var self = this;
//   var blockingPromises = [];
//   var $ = yield self.getCheerioPromise(pageSource);
// });


ScrapHandler.prototype.getHandleableURLPattern = function (){
  return /whatever-you-want\.com\/en\/(?:default\/\d+|$)/g;
};

//test the code in chrome first
ScrapHandler.prototype.scrap = co.wrap(function*(pageSource){
  var self = this;
  var blockingPromises = [];
  var $ = yield self.getCheerioPromise(pageSource);

  //get all the links
  var allDomainLink = self.getAllLinksContains($, "whatever-you-want.com");

  var nextPageUrl = $('a[title="next page"]').attr("href");
  self.tryCrawl(nextPageUrl).catch(self.onNonYieldedError);

  var trs = $('tr.white, tr.gray');
  for (var i = trs.length - 1; i >= 0; i--) {
    var tds = $( trs[i] ).children();

    var rawhostname = $(tds[0]).text();
    var rawcountry = $(tds[1]).text();
    var rawresponseTime = $(tds[2]).text();
    var rawanonymity = $(tds[3]).text();
    var rawproxyType = $(tds[6]).text();
    var rawcheckDate = $(tds[7]).text();

    if(rawcountry !== "CN" && rawcountry !== "TW" && rawcountry !== "HK" && rawcountry !== "JP"){
      return;
    }

    var ip =  rawhostname.split(':')[0].trim();
    var port =  rawhostname.split(':')[1].trim();
    var country = rawcountry.toLowerCase().trim();
    var responseTime = rawresponseTime.replace("s", "").trim();
    var anonymity = 0;

    var data = {
      hostname : rawhostname,
      ip: ip,
      port: port,
      country : country,
      response_time : responseTime,
      anonymity : anonymity,
      proxy_type : rawproxyType,
      check_date : rawcheckDate
    };

    self.trimStringProperties(data);

    self.mongodbClient
     .getPromisifiedCollection('web_proxys')
     .updateAsync({ip:ip}, data, {upsert:true}).catch(self.onNonYieldedError);
  }

  yield blockingPromises;
});

module.exports = ScrapHandler;
