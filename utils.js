/*
    MLAB Compiler Service
    Utility functions
    
    Author: Snapper Net Solutions
    Copyright (c) 2015
*/

// Get config. To switch between development and production modes, set the 
// environment variable "NODE_ENV" to "production" or "development".
var env = process.env.NODE_ENV || "development";
var config = require(__dirname + "/config/config.json")[env];

// Add requirements
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");

// Some global variables
var environment, uid, gid;

/*
    Setup various things. Extend environment with key/value pairs given in 
    config. Get uid and gid from system, based on config. Should be called when 
    Node.js starts.
*/
exports.setup = function() {
    // Extend user"s environment variables with what was given in config
    var environment = process.env;
    for (key in config.environment) {
        var value = config.environment[key];
        // If value starts with $:, this means that we should append value, not replace
        if (value.slice(0,2)=="$:") {
            value = value.slice(1);
            if (key in environment) value = environment[key] + value;
        }
        environment[key] = value;
    }
    
    // Get user ID/group ID on system
    var user = config.cordova_user || environment.USER;
    // These are asynchronous funcitons, but we assume that no one is making any calls within the first
    // couple of milliseconds after startup. So we don't bother with a callback in the setup phase.
    if (user!==environment.USER) {
        // Unix/Linux/OSX
        var getUid = child_process.spawn("id", ["-u", user], {env:environment});
        getUid.stdout.on("data", function(data) {
            uid = parseInt(data.toString());
            console.log("Running commands as %s, %s", user, uid);
        });
        getUid.stderr.on("data", function (data) {
            console.log("stderr: " + data);
            uid = null;
        }
        var getGid = child_process.spawn("id", ["-u", user], {env:environment});
        getGid.stdout.on("data", function(data) {
            gid = parseInt(data.toString());
        });
        getGid.stderr.on("data", function (data) {
            console.log("stderr: " + data);
            gid = null;
        }
    }
    else {
        // If we are already running as the user specified in config, we unset these.
        uid = null;
        gid = null;
    }
};

/*
    Get system UID for user defined in config. Should already be set up.
    @return: Number. UID.
*/
exports.getUid = function() {
    return uid;
};

/*
    Get system GID for user defined in config. Should already be set up.
    @return: Number. GID.
*/
exports.getGid = function() {
    return gid;
};

/*
    Get config object.
    @return: Object.
*/
exports.getConfig = function() {
    return config;
};

/*
    Get environment. This is a combination of Node.js' process environment, and 
    values given in config file.
    @return: Object.
*/
exports.getEnvironment = function() {
    return environment;
};

/*
    Get all directories recursively from basePath. Stops at depth and calls 
    callback function.
    @param basepath: String. Path to start at. Required.
    @param depth: Depth to search. Counts down for every recursive call, 
        and when it reaches zero, the callback function is called. Required.
    @param callback: Function. Callback function to call when finished. Should 
        accept parameter containing array of absolute paths for all the 
        directories found. Required.
    @param dir: Array. Directories found so far, and to build on. Optional.
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

