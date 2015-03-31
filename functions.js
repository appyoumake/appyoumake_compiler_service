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
    }
    var appUid = "app_uid" in params ? params.app_uid : null;
    var appVersion = "app_version" in params ? params.app_version : null;
    utils.getApps(appUid, appVersion, function(apps) {
        var appsObj = {};
        for (var i=0, ii=apps.length; i<ii; i++) {
            var app = apps[i];
            if (!(app.id in appsObj)) appsObj[app.id] = [];
            appsObj[app.id].push({
                app_version: app.version, 
                app_uid: app.id, 
                compiled: app.compiled, 
                compiled_date: app.compiledDate
            });
        }
        
        res.send(200, appsObj);
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
        if (!apps.length) {
            console.log("no app");
            utils.createNewApp(appUid, appVersion, createAppFinished);
        }
        else createAppFinished(apps[0]);
    });
    res.send(200, true);
    console.log("returning");
    return next();
};

exports.verifyApp = function(req, res, next) {
    console.log("verifyApp");
    var params = req.params;
    if (!utils.checkPassPhrase(params)) {
        console.log("bad passphrase");
        res.send(403);
        return next();
    }
    var appUid = "app_uid" in params ? params.app_uid : null;
    var appVersion = "app_version" in params ? params.app_version : null;
    var checksum = "checksum" in params ? params.checksum : null;
    if (!appUid || !appVersion || !checksum) {
        res.send(500);
        return next();
    }
    utils.getApps(appUid, appVersion, function(apps) {
        if (apps) {
            var app = apps[0];
            app.verify(checksum, function(verified) {
                utils.performCallback("verifyApp", {app_uid: app.id, app_version: app.version, result: verified});
            });
        }
        else {
            utils.performCallback("verifyApp", {app_uid: appUid, app_version: appVersion, result: false});
        }
    });
    res.send(200, true);
    return next();
};

exports.compileApp = function(req, res, next) {
    console.log("compileApp");
    var params = req.params;
    if (!utils.checkPassPhrase(params)) {
        console.log("bad passphrase");
        res.send(403);
        return next();
    }
    var appUid = "app_uid" in params ? params.app_uid : null;
    var appVersion = "app_version" in params ? params.app_version : null;
    var checksum = "checksum" in params ? params.checksum : null;
    var platform = "platform" in params ? params.platform : null;
    
    if (!appUid || !appVersion || !checksum || !platform) {
        res.send(500);
        return next();
    }

    utils.getApps(appUid, appVersion, function(apps) {
        if (apps) {
            var app = apps[0];
            app.verify(checksum, function(verified) {
                if (verified) {
                    app.checkCompiled(checksum, function(compiled) {
                        if (compiled) {
                            // Not sure if "compiled" in callback should be true or false here. App is compiled, but not as result of this request.
                            utils.performCallback("compileApp", {app_uid: app.id, app_version: app.version, checksum: app.checksum, platform: platform, result: true}); 
                        }
                        else {
                            app.compile(platform, function(compiled) {
                                utils.performCallback("compileApp", {app_uid: app.id, app_version: app.version, checksum: app.checksum, platform: platform, result: compiled});
                            });
                        }
                    });
                }
                else {
                    utils.performCallback("compileApp", {app_uid: app.id, app_version: app.version, checksum: app.checksum, platform: platform, result: false});
                }
            });
        }
        else {
            utils.performCallback("compileApp", {app_uid: appUid, app_version: appVersion, checksum: null, platform: platform, result: false});
        }
    });

    res.send(200, true);
    return next();
};

exports.getApp = function(req, res, next) {
    
};

function createAppFinished(app) {
    console.log("createAppFinished");
    // handle error situation, when there is no app, create failed
    app.getChecksum(function(checksum) {
        console.log("checksum: " + checksum);
        utils.performCallback("createApp", {checksum: checksum, app_uid: app.id});
    });
};