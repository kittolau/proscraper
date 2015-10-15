var jsyaml = require('js-yaml');
var fs   = require('fs');
var path = require('path');

try {
	var WEBOT_ENV = typeof(process.env.WEBOT_ENV) == 'undefined' ? 'development' : process.env.WEBOT_ENV;
	var pathToConfig = path.join(__dirname,'config.yml');
	var config = jsyaml.safeLoad(fs.readFileSync(pathToConfig));
	
	if(!config.hasOwnProperty(WEBOT_ENV)){
		throw new Error('"'+ WEBOT_ENV + '" does not exist in config')
	}
	
	var scoped_config = config[WEBOT_ENV];
	if(!scoped_config.hasOwnProperty('root')){
		scoped_config['root'] = path.join(__dirname,'..');
	}
	
	module.exports = scoped_config
} catch (e) {
	console.log(e);
}