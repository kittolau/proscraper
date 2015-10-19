var HttpProxyAgent = require('http-proxy-agent');
var HttpsProxyAgent = require('https-proxy-agent');
var https    = require('https');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

//test param
var httpProxy = 'http://127.0.0.1:3128';
var httpAgent = new HttpProxyAgent(httpProxy);
var httpsProxy = 'http://127.0.0.1:3128';
var httpsAgent = new HttpsProxyAgent(httpsProxy);
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

//test
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




