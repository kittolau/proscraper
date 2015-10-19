var socks = require('socksv5');
var http    = require('http');
var https    = require('https');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

//test param
var socksConfig       = {
  proxyHost: 'localhost',
  proxyPort: 9050,
  auths: [ socks.auth.None() ]
};
var httpAgent         = new socks.HttpAgent(socksConfig);
var httpsAgent        = new socks.HttpsAgent(socksConfig);
httpAgent.maxSockets  = 20;
httpsAgent.maxSockets = 20;
var connectionCount   = 20;
var timeout           = 10000;
var requestConfig     = {
  url : "https://github.com/kittolau",
  method : "GET",
  agent :  httpAgent,
  followRedirect : true,
  maxRedirects: 10,
  timeout : timeout
};

var allp      = [];
var failCount = 0;
for (var i = connectionCount - 1; i >= 0; i--) {
  var p = new Promise(function (resolve, reject){
    var startTime = Date.now();
    request(requestConfig,function(err,res,body){
      if(err){
        //console.log(err);
        failCount++;
      }
      if(res){
        //console.log("success");
      }
      var duration = Date.now() - startTime;
      resolve(duration);
    });
  });
  allp.push(p);
}
Promise
.all(allp)
.then(function(times){
  var totalTime = times.reduce(function(l,r){ return l+r;});
  console.log("Fail Count: " + failCount + "/"+connectionCount);
  console.log("Fail Rate: " + failCount / connectionCount * 100 + "%");
  console.log("Avg. Request Time: " + totalTime / connectionCount + "ms");
});
