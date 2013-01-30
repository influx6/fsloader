module.exports = (function(){

	var ts = require('ts').ToolStack,
	FileError = ts.Errors.createError('FileError'),
	extjs = /\.js$/,
	path = require('path'),
	fs = require('fs'),
	root = this,
	vm = require('vm'),
	util = ts.Utility,
	setDir = function setDir(dir){
		var dir = path.resolve(dir);
		if(fs.existsSync(dir)) return;
		return fs.mkdirSync(dir,['0777']);
	},
	yankDir = function yankDir(dir){
		var dir = path.resolve(dir);
		if(!fs.existsSync(dir)) return;
		return fs.rmdirSync(dir);
	},
	readSource = function readSource(file){
		if(!fs.existsSync(file)) throw new Error('Path does not exists:'+file);
		var cp = path.resolve(file);
		return fs.readFileSync(cp);
	},
	saveSource = function(file,source){
		var out = path.resolve(file);
		fs.writeFileSync(out,source,'utf8');
	},
	vmscript = function createScript(source,name){
		return vm.createScript(source,name);
	},
	helpers = ts.Helpers.HashMaps,
	fsl = { savepoint: './vms',lists: {}, cache: {}};

	/*
		@Function addSource
		@option key:String - the key used to store the already added source
		@option mustReload:Boolean - a boolean value to indicate a reload and reexecution of the source incase changes
	*/

	fsl.require = function flsRequire(key,mustReload){
		if(mustReload) return this.reload(key);
		return this.load(key);
	};

	/*
		@Function add
		@option name:String - the title for the file
		@option source:String - the path of the file
	*/

	fsl.add = function fslAdd(key,loc,context){
		if(helpers.exists.call(this.lists,key)) throw new Error('Key already used for a source,please choose another!');

		var loc = path.resolve(loc),box = null;
		if(!fs.existsSync(loc)) return false;

		
		box = vm.createContext(context || root);
		if(!box.module) box.module = module;
		if(!box.require) box.require = module.require;
		if(!box.exports) box.exports = module.exports;
		if(!box.console) box.console = console;

		return helpers.add.call(this.lists,key,{
			key: key,
			path: loc,
			box: box
		});

	};

	/*
		@Function addSource
		@option name:String - the title for the source
		@option source:String - a string of js code
		@option context - the sandbox to be used as global in executing the source
	*/

	fsl.addSource = function fslAddSource(key,source,context){
		if(helpers.exists.call(this.lists,key)) throw new Error('Key already used for a source,please choose another!');

		var out = path.resolve(this.savepoint,key);
		out = extjs.test(out) ? out.replace(/\.js$/,'.vms') : out.concat('.vms');

		saveSource(out,source);
		return this.add(key,out,context);
	};

	fsl.load = function fslLoad(key){
		if(!helpers.exists.call(this.lists,key)) return false;

		if(helpers.exists.call(this.cache,key)) return helpers.fetch.call(this.cache,key);

		var item = helpers.fetch.call(this.lists,key),
			res  = this._execute(item);

		helpers.add.call(this.cache,key,res);

		return res;
	};

	fsl._execute = function _fslExecute(src){
		if(!src || !util.isObject(src)) return false;

		var	code = readSource(src.path),script,res;
		
		script = vmscript(code,src.path);

		res = script.runInNewContext(src.box);

		if(!res) return true;
		// if(src.args && util.isFunction(res)) res = res.apply(null,src.args);

		return res;
	};

	fsl.reload = function fslReload(key){
		if(!helpers.exists.call(this.lists,key)) return false;
		delete this.cache[key];
		return this.load(key);
	};

	fsl.loadAll = function fslLoadAll(){
		this.eachHelper(this.lists,function(e,i){
			this.load(i);
		});
	};

	fsl.reloadAll = function fslReloadAll(){
		this.eachHelper(this.lists,function(e,i){
			this.reload(i);
		});
	};

	fsl.remove = function fslRemove(key){
		helpers.remove.call(this.cache,key);
		helpers.remove.call(this.lists,key);
		return;
	};

	fsl.flush = function fslRemoveAll(){
		util.explode(this.lists);
		util.explode(this.cache);
		return;
	};

	fsl.eachHelper = function fslEachHelper(store,callback){
		return util.eachAsync(store,function(e,i,o,fn){
			callback.call(this,e,i);
			fn(false);
		},null,this);
	};

	return {
		create: function FSLoader(savepoint){
			var  o = util.clone(fsl,{});
			if(savepoint) o.savepoint = savepoint;
			o.savepoint = path.resolve(o.savepoint);
			setDir(o.savepoint);
			return o;
		}
	};

})();