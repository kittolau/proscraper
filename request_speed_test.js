var Promise    = require('bluebird');
var request    = Promise.promisify(require('request'));

var requestConfig = {
    url : "http://www.getproxy.jp/en/",
    method : "GET",
    followRedirect : true,
    timeout : 10000,
    agent: false
  };

  // console.time("timeout-promise");
  // request(requestConfig)
  // .then(function(result){
  //   console.timeEnd("timeout-promise");
  // })

  console.time("timeout");
  request(requestConfig,function(err,res){
    console.timeEnd("timeout");
  });

