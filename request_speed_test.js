var socks = require('socksv5');
var Promise    = require('bluebird');
var request    = Promise.promisify(require('request'));


var socks = require('socksv5');
  var http = require('http');

  var socksConfig = {
    proxyHost: 'localhost',
    proxyPort: 9050,
    auths: [ socks.auth.None() ]
  };

var requestConfig = {
    url : "http://www.getproxy.jp/",
    method : "GET",
    agent: new socks.HttpAgent(socksConfig),
    //agent :  new http.Agent(),
    // agentClass: Agent,
    // agentOptions: {
    //     socksHost: '127.0.0.1',
    //     socksPort: 9050 // Defaults to 1080.
    // },
    followRedirect : true,
    // proxy: "http://177.222.177.14:8080",
    // tunnel: true,
    timeout : 10000,
    // agent: false
  };



  // http.get({
  //   host: 'whatsmyip.net',
  //   port: 80,
  //   method: 'HEAD',
  //   path: '/',
  //   agent: new socks.HttpAgent(socksConfig)
  // }, function(res) {
  //   res.resume();
  //   console.log(res.statusCode, res.body);
  // });


  console.time("timeout");
  request(requestConfig,function(err,res,body){

    if(err){
      console.log(err);
    }

    if(res){
      console.log(body);
    }


    console.timeEnd("timeout");
  });

