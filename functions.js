/*
    MLAB Compiler Service
    Functions for app
    
    Author: Snapper Net Solutions
    Copyright (c) 2015
*/
var utils = require('./utils.js');

exports.getAppStatus = function(req, res, next) {
    console.log("getAppStatus");
    var params = req.params;
    if (!utils.checkPassPhrase(params)) {
        console.log("bad passphrase");
        res.send(403);
        return next();
    var appUid = "app_uid" in params ? params.app_uid : null;
    var appVersion = "app_version" in params ? params.app_version : null;
    var apps = utils.getApps(appUid, appVersion, function(apps) {
        res.send(200, apps);
    });
    return next();
};

exports.createApp = function(req, res, next) {
    console.log("createApp");
    var params = req.params;
    if (!utils.checkPassPhrase(params)) {
        console.log("bad passphrase");
        res.send(403);
        return next();
    }
    var appUid = "app_uid" in params ? params.app_uid : null;
    var appVersion = "app_version" in params ? params.app_version : null;
    if (!appUid || !appVersion) {
        res.send(500);
        return next();
    }
    utils.getApps(appUid, appVersion, function(apps) {
        console.log(apps);
        if (!apps) utils.createApp(appUid, appVersion, createAppFinished);
        else createAppFinished(apps)
    });
    res.send(200, true);
    console.log("returning");
    return next();
};

exports.verifyApp = function(req, res, next) {
    
};

exports.compileApp = function(req, res, next) {
    
};

exports.getApp = function(req, res, next) {
    
};

function createAppFinished(app) {
    utils.getChecksum(app, function(checksum, app) {
        var appId = Object.keys(app)[0];
        utils.performCallback("createApp", {checksum: checksum, app_uid: appId});
    });
};