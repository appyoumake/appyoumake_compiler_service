/**
    MLAB Compiler Service
    Utility functions
    
    @author Author: Snapper Net Solutions
    @copyright Copyright (c) 2015
    @module Utils
*/

// Get config.
var config = require(__dirname + "/config/config.json");

// Add requirements
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var log4js = require("log4js"); 

// Some global variables
var environment, uid, gid, logger;

/**
    Setup various things. Extend environment with key/value pairs given in config. Get uid and gid from system, based on config. Should be called when Node.js starts.
*/
exports.setup = function() {
    // Set up log file
    log4js.configure({
        "type": "clustered",
        "appenders": [
            {
                "type": "file",
                "filename": "logs/mlabcompiler.log",
                "maxLogSize": 10485760,
                "backups": 10,
                "category": "mlabcompiler"
            },
            {
                "type": "logLevelFilter",
                "level": "ERROR",
                "appender": {
                    "type": "file",
                    "filename": "logs/errors.log"
                }
            }
        ]
    });
    logger = log4js.getLogger("mlabcompiler");
    logger.setLevel(config.log_level);
    
    // Extend user"s environment variables with what was given in config
    environment = process.env;
    for (key in config.environment || {}) {
        var value = config.environment[key];
        // If value starts with $:, this means that we should append value, not 
        // replace
        if (value.slice(0,2)=="$:") {
            value = value.slice(1);
            if (key in environment) value = environment[key] + value;
        }
        environment[key] = value;
    }
    
    // Get user ID/group ID on system
    var user = config.cordova_user || environment.USER;
    // These are asynchronous funcitons, but we assume that no one is making any 
    // calls within the first couple of milliseconds after startup. So we 
    // don't bother with a callback in the setup phase.
    if (user!==environment.USER) {
		if (config.os==="windows") {
			;
		}
		else {
			// Unix/Linux/OSX
			var getUid = child_process.spawn("id", ["-u", user], {env:environment});
			getUid.stdout.on("data", function(data) {
				uid = parseInt(data.toString());
				exports.log("Running commands as " + user + ", " + uid, exports.logLevel.info, true);
			});
			getUid.stderr.on("data", function (data) {
				exports.log("stderr: " + data, exports.logLevel.error);
				uid = null;
			});
			var getGid = child_process.spawn("id", ["-g", user], {env:environment});
			getGid.stdout.on("data", function(data) {
				gid = parseInt(data.toString());
			});
			getGid.stderr.on("data", function (data) {
				exports.log("stderr: " + data, exports.logLevel.error);
				gid = null;
			});
		}
    }
    else {
        // If we are already running as the user specified in config, we unset 
        // these.
        uid = null;
        gid = null;
    }
    

};

/**
    Log to file, using log4js
    @param {String} str - String to log. Optional.
    @param {Number} level - Log level, should be fetched from utils.logLevel. Optional.
    @param {Boolean} toConsole - Should we also log to console.log. Optional.
*/
exports.log = function(str, level, toConsole) {
    if (!str) str = "";
    if (toConsole) console.log(str);
    switch(level) {
        case 0:
            logger.trace(str);
            break;
        case 1:
            logger.debug(str);
            break;
        case 2:
            logger.info(str);
            break;
        case 3:
            logger.warn(str);
            break;
        case 4:
            logger.error(str);
            break;
        case 5:
            logger.fatal(str);
            break;
        default:
            logger.debug(str);
    }
};

/**
    Object containing available log levels
*/
exports.logLevel = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    warning: 3,
    error: 4,
    fatal: 5
};

/**
    Get system UID for user defined in config. Should already be set up.
    @returns {Number} UID.
*/
exports.getUid = function() {
    return uid;
};

/**
    Get system GID for user defined in config. Should already be set up.
    @returns {Number} GID.
*/
exports.getGid = function() {
    return gid;
};

/**
    Get config object.
    @returns {Object}
*/
exports.getConfig = function() {
    return config;
};

/**
    Get environment. This is a combination of Node.js" process environment, and values given in config file.
    @returns {Object}
*/
exports.getEnvironment = function(platform) {
    var env  = environment;
    if (platform) {
        env = exports.clone(environment);
        for (key in config[platform].environment || {}) {
            env[key] = config[platform].environment[key];
        }
    }
    return env;
};

/**
    Get all directories recursively from basePath. Stops at depth and calls callback function.
    @param {String} basepath - Path to start at. Required.
    @param {Number} depth - Depth to search. Counts down for every recursive call, and when it reaches zero, the callback function is called. Required.
    @param {Function} callback - Callback function to call when finished. Should accept parameter containing array of absolute paths for all the directories found. Required.
    @param {Array} dir - Directories found so far, and to build on. Optional.
*/
exports.getDirs = function(basePath, depth, callback, dirs) {
    if (!dirs) dirs = []
    if (!depth) return callback(dirs);
    fs.readdir(basePath, function(err, files) {
        for (var i=0, ii=files.length; i<ii; i++) {
            var dirPath = path.join(basePath, files[i]);
            var stat = fs.statSync(dirPath);
            if (!stat.isDirectory()) continue;
            if (depth==1) dirs.push(dirPath);
            exports.getDirs(dirPath, depth-1, callback, dirs);
        }
    });
};


/**
    Clone an object. This will not work for all objects, only objects with simple (enough) properties.
    @param {Object} ob - The Object to be cloned.
    @param {Boolean} deep - Controls whether we should recurse into sub-objects. Might cause inifite loops.
    @returns {Object} New, identical object
*/
exports.clone = function(ob,deep) {
  var objectClone = {};
  for (var property in ob)
    if (!deep)
      objectClone[property] = ob[property];
    else if (typeof ob[property] == 'object' && ob[property])
      objectClone[property] = clone(ob[property], deep);
    else
      objectClone[property] = ob[property];
  return objectClone;
}

/**
    Check for a file's existence and perform callback. Can be used both for waiting for a lock file to disappear, and for waiting until a certain file has been created.
    @param {String} filePath - Path to file. Required
    @param {Number} interval - Interval between each file check, in ms. Optional. Default 1000.
    @param {Number} maxTime - The maximum time we try until we give up, in ms. Optiona. Default 10000.
    @param {String} criteria - What the success criteria is. "notexists": Wait until file in question disappears. "exists": Wait until file in question appears. Optional. Default "notexists".
    @param {Number} timeElapsed - How much time has passed since we started. Used for internal, recursive calls. Optional.
*/
exports.checkFileAndDo = function(filePath, interval, maxTime, criteria, callback, timeElapsed) {
    utils.log("checkFileAndDo " + filePath, utils.logLevel.debug);
    if (!interval) interval = 1000; // One second
    if (!maxTime) maxTime = 10000; // Ten seconds
    if (!criteria) criteria = "notexists";
    if (!timeElapsed) timeElapsed = 0;
    // Check file
    fs.stat(filePath, function(err, stat) {
        // Criteria is met. Do the thing.
        if ((criteria==="notexists" && err) || (criteria==="exists" && !err)) callback(true);
        // Lock file exists.
        else {
            // Check if we have passed our timeout
            utils.log("timeElapsed: " + timeElapsed, utils.logLevel.debug);
            if (timeElapsed>=maxTime) {
                utils.log("giving up, took too long", utils.logLevel.error);
                callback(false);
            }
            // Otherwise, wait some time and try again
            else {
                if (criteria==="notexists") utils.log("wait for lock file to disappear", utils.logLevel.debug);
                if (criteria==="exists") utils.log("wait for file to appear", utils.logLevel.debug);
                setTimeout(function() { 
                    timeElapsed += interval;
                    exports.checkFileAndDo(filePath, interval, maxTime, criteria, callback, timeElapsed);
                }, interval);
            }
        }
    });
}

var utils = exports;

/**
    Helper function for check the ends of strings. Since this is added to 
    String's prototype, it will apply to all strings in the project.
*/
if (typeof String.prototype.endsWith != 'function') { String.prototype.endsWith = function (str){
    try { return this.slice(-str.length) == str; }
    catch(e) { return false; }
};}