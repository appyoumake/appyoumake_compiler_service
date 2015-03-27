/*
    MLAB Compiler Service
    Utility functions
    
    Author: Snapper Net Solutions
    Copyright (c) 2015
*/

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/config/config.json')[env];

var fs = require('fs');
var xmldoc = require('xmldoc');

exports.checkPassPhrase = function(params) {
    var passphrase = null;
    if ("passphrase" in params) passphrase = params.passphrase
    return passphrase===config.passphrase;
};

exports.getApps = function(appUid, appVersion, callback) {
    var path = [".", "apps"];
    if (appUid) {
        path.push(appUid);
        if (appVersion) path.push(appVersion);
    }
    var pathLength = path.length;
    path = path.join("/")
    fs.stat(path, function(err, stat) {
        if (err || !stat.isDirectory()) return callback({});
        // We assume both uid and version is given
        var depth = 0;
        // No uid, no version
        if (pathLength==2) depth = 2;
        // Uid, but no version
        else if (pathLength==3) depth = 1;
        
        getDirs(path, depth, function(appPaths) {
            if (depth==0) appPaths = [path];
            var apps = {};
            for (var i=0, ii=appPaths.length; i<ii; i++) {
                var appPath = appPaths[i].split("/");
                var appId = appPath[2];
                var appVersion = appPath[3];
                
                var configXML = readConfigXML(appPaths[i]);
                var appName = configXML ? configXML.valueWithPath("name") : "";
                
                // TODO: Check if compiled and when
                
                if (!(appId in apps)) apps[appId] = [];
                apps[appId].push({app_version: appVersion, app_name: appName, compiled: false, compiled_date: null})
            }
            return callback(apps);
        });
    });
};

exports.createApp = function(appUid, appVersion, callback) {
    
};

exports.getChecksum = function(app, callback) {
    
};

exports.performCallback = function(callbackType, params) {
    
};

/* Internal utilities, that need not be exported */


function getDirs(path, depth, callback, dirs) {
    if (!dirs) dirs = []
    if (!depth) return callback(dirs);
    fs.readdir(path, function(err, files) {
        for (var i=0, ii=files.length; i<ii; i++) {
            fs.stat(path + "/" + files[i], function(err ,stat) {
                if (err || !stat.isDirectory()) return
                if (depth==1) dirs.push(path + "/" + files[i]);
                else getDirs(path + "/" + files[i], depth-1, callback, dirs);
            });
        }
    });
};

function readConfigXML(path) {
    path = path + "/config.xml";
    if (!fs.statSync(path).isFile()) return null;
    var configXML = fs.readFileSync(path, {encoding: "utf-8"});
    configXML = new xmldoc.XmlDocument(configXML);
    
    return configXML;
};