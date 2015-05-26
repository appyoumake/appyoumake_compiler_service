/**
    MLAB Compiler Service
    Functions for app
    
    @author Author: Snapper Net Solutions
    @copyright Copyright (c) 2015
    @module Functions
*/

// Add Node modules
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var http = require("http");
var https = require("https");
var querystring = require("querystring");

// Mlab modules
var mlabapp = require("./mlabapp.js");
var utils = require('./utils.js');

/* Constants */
// Addresses for callbacks
var CALLBACK_URIS = {
    "createApp": "/callback/csAppCreated",
    "verifyApp": "/callback/csAppVerified",
    "compileApp": "/callback/csAppCompiled"
};

// Setup some stuff
utils.setup();
var environment = utils.getEnvironment();
var config = utils.getConfig();


/*******************************************************************************
    Functions exported in module, and thus available as functions.funcionName().
*******************************************************************************/

/**
    Gets status for app or apps. If 
    Parameters in request:
        passphrase: String. Shared secret to validate request. Required.
        app_uid: String. ID of app. Optional.
        app_version: String. Version number of app. Optional.
        platform: String. Platform we are interested in. Optional.
    If neither request params are given, will return all apps. If app_uid is given, but not app_version, will return all version for that app. If app_uid and app_version is given, will return that specific app.
    Sends response as JSON on the form:
    {
        <app id, string>: {
            <app_version, string>: {
                <platform, string>: {
                    compiled: <boolean>,
                    compiled_date: <date or null>
                }, (..)
            }, (..)
        }, (..)
    }    
    @param {Object} req - Restify request object
    @param {Object} res - Restify response object
    @param {Function} next - Function to call next
*/
exports.getAppStatus = function(req, res, next) {
    utils.log("getAppStatus", utils.logLevel.debug);
    var paramNames = [
        {"name": "app_uid", "required": false},
        {"name": "app_version", "required": false},
        {"name": "platform", "required": false}
    ]
    var statusParams = prepareRequest(req, paramNames);
    var status = statusParams[0];
    var params = statusParams[1];
    if (status!=200) {
        res.send(status, "Error");
        return next()
    }
    getApps(params.app_uid, params.app_version, function(apps) {
        var appsObj = {};
        for (var i=0, ii=apps.length; i<ii; i++) {
            var app = apps[i];
            if (!(app.id in appsObj)) appsObj[app.id] = {};
            var appObj = {};
            var compiledInfo = app.getCompiledInfo(params.platform);
            for (platform in compiledInfo) {
                appObj[platform] = {
                    compiled: compiledInfo[platform].compiled,
                    compiled_date: compiledInfo[platform].compiledDate
                };
            }
            appsObj[app.id][app.version] = appObj;
        }
        
        res.send(200, appsObj);
    });
    return next();
};

/**
    Create a new Cordova app. This is an asynchronous function, in that it always returns true, and fetches a callback URL when done. If app already 
    exists, fetch callback URL with app info as if it was created by this call.
    Parameters in request:
        passphrase: String. Shared secret to validate request. Required.
        app_uid: String. ID of app. Required.
        app_version: String. Version number of app. Required.
        config_xml: String. XML file with Cordova config settings. If not a 
            valid Cordova config file, following actions will likely fail. Required.
    Info sent in callback URL:
        checksum: String. Checksum of entire www directory in app
        app_uid: String. ID of app
    Sends JSON response as an always true Boolean.
    @param {Object} req - Restify request object
    @param {Object} res - Restify response object
    @param {Function} next - Function to call next
*/
exports.createApp = function(req, res, next) {
    utils.log("createApp", utils.logLevel.debug);
    
    /*
        Callback function for when createApp finishes (succesful or not).
        @param {App object} app - Optional.
    */
    function createAppFinished(app, appId, appVersion) {
        utils.log("createAppFinished", utils.logLevel.debug);
        // handle error situation, when there is no app, create failed
        if (app) {
            app.getChecksum(function(checksum) {
                performCallback("createApp", {checksum: checksum, app_uid: app.id, app_version: app.version});
            });
        }
        else performCallback("createApp", {checksum: null, app_uid: appId, app_version: appVersion});
    };

    var paramNames = [
        {"name": "app_uid", "required": true},
        {"name": "app_version", "required": true},
        {"name": "config_xml", "required": true}
    ]
    var statusParams = prepareRequest(req, paramNames);
    var status = statusParams[0];
    var params = statusParams[1];
    
    if (status!==200) {
        res.send(status, "Error in prepareRequest");
        return next()
    }
    getApps(params.app_uid, params.app_version, function(apps) {
        if (!apps.length) {
            utils.log("no app", utils.logLevel.debug);
            createNewApp(params.app_uid, params.app_version, params.config_xml, createAppFinished);
        }
        else createAppFinished(apps[0], params.app_uid, params.app_version);
    });
    res.send(200, true);
    return next();
};

/**
    Verify that the app contains what we expect. This is done by comparing a given checksum to the calculated checksum of what is on disk. This is an 
    asynchronous call. It always returns true, and fetches a callback URL when done.
    Parameters in request:
        passphrase: String. Shared secret to validate request. Required.
        app_uid: String. ID of app. Required.
        app_version: String. Version number of app. Required.
        checksum: String. Checksum to check against. Required.
    Info sent in callback URL:
        app_uid: String. ID of app checked
        app_version: String. Version of app checked
        result: Boolean. The result of the checksum comparison.
    Sends JSON response as an always true Boolean.
    @param {Object} req - Restify request object
    @param {Object} res - Restify response object
    @param {Function} next - Function to call next
*/
exports.verifyApp = function(req, res, next) {
    utils.log("verifyApp", utils.logLevel.debug);
    var paramNames = [
        {"name": "app_uid", "required": true},
        {"name": "app_version", "required": true},
        {"name": "checksum", "required": true}
    ]
    var statusParams = prepareRequest(req, paramNames);
    var status = statusParams[0];
    var params = statusParams[1];
    if (status!=200) {
        res.send(status, "Error");
        return next()
    }
    getApps(params.app_uid, params.app_version, function(apps) {
        if (apps) {
            var app = apps[0];
            app.verify(params.checksum, function(verified) {
                performCallback("verifyApp", {app_uid: app.id, app_version: app.version, result: verified});
            });
        }
        else {
            performCallback("verifyApp", {app_uid: params.app_uid, app_version: params.app_version, result: false});
        }
    });
    res.send(200, true);
    return next();
};

/**
    Compile app, using Cordova's functions, after performing some internal checks. This is an aynchronous call. It always returns true, and fetches a callback URL when done. If app does not exist, if the checksums don't match, the platform isn't properly set up on server, or the compilation fails in any other way, the "result" parameter in the callback will be set to false.
    Parameters in request:
        passphrase: String. Shared secret to validate request. Required.
        app_uid: String. ID of app. Required.
        app_version: String. Version number of app. Required.
        checksum: String. Checksum to check against. Required.
        platform: String. Name of platform to compile for. Required.
    Info sent in callback URL:
        app_uid: String. ID of app checked
        app_version: String. Version of app checked
        checksum: String. Checksum of compiled app www directory.
        platform: String. Platform that was compiled for.
        result: Boolean. The result of the compilation. True if compile was OK, false if not.
    Sends JSON response as an always true Boolean.
    @param {Object} req - Restify request object
    @param {Object} res - Restify response object
    @param {Function} next - Function to call next
*/
exports.compileApp = function(req, res, next) {
    utils.log("compileApp", utils.logLevel.debug);
    var paramNames = [
        {"name": "app_uid", "required": true},
        {"name": "app_version", "required": true},
        {"name": "checksum", "required": true},
        {"name": "platform", "required": true}
    ]
    var statusParams = prepareRequest(req, paramNames);
    var status = statusParams[0];
    var params = statusParams[1];
    if (status!=200) {
        res.send(status, "Error");
        return next()
    }

    getApps(params.app_uid, params.app_version, function(apps) {
        if (apps) {
            var app = apps[0];
            app.verify(params.checksum, function(verified) {
                if (verified) {
                    app.checkCompiled(params.platform, params.checksum, function(compiled) {
                        if (compiled) {
                            // Not sure if "compiled" in callback should be true or false here. App is compiled, but not as result of this request.
                            utils.log("app already compiled", utils.logLevel.debug);
                            performCallback("compileApp", {app_uid: app.id, app_version: app.version, checksum: app.checksum, platform: params.platform, result: true}); 
                        }
                        else {
                            app.compile(params.platform, function(compiled) {
                                performCallback("compileApp", {app_uid: app.id, app_version: app.version, checksum: app.checksum, platform: params.platform, result: compiled});
                            });
                        }
                    });
                }
                else {
                    utils.log("wrong checksum for app", utils.logLevel.error);
                    performCallback("compileApp", {app_uid: app.id, app_version: app.version, checksum: app.checksum, platform: params.platform, result: false});
                }
            });
        }
        else {
            utils.log("no app found", utils.logLevel.error);
            performCallback("compileApp", {app_uid: params.app_uid, app_version: params.app_version, checksum: null, platform: params.platform, result: false});
        }
    });

    res.send(200, true);
    return next();
};

/**
    Get the actual executable file for given app ID, version, and platform. Performs a few internal checks first. If app doesn't exist, checksum doesn't match, app isn't compiled or executable file isn't found, returns and error response, with 500 as error code and an error message.
    Parameters in request:
        passphrase: String. Shared secret to validate request. Required.
        app_uid: String. ID of app. Required.
        app_version: String. Version number of app. Required.
        checksum: String. Checksum to check against. Required.
        platform: String. Name of platform to compile for. Required.
    Sends a response containing the file, or a JSON object with error response.
    @param {Object} req - Restify request object
    @param {Object} res - Restify response object
    @param {Function} next - Function to call next
*/
exports.getApp = function(req, res, next) {
    utils.log("getApp", utils.logLevel.debug);
    var paramNames = [
        {"name": "app_uid", "required": true},
        {"name": "app_version", "required": true},
        {"name": "checksum", "required": true},
        {"name": "platform", "required": true}
    ]
    var statusParams = prepareRequest(req, paramNames);
    var status = statusParams[0];
    var params = statusParams[1];
    if (status!=200) {
        res.send(status, "Error");
        return next()
    }
    
    getApps(params.app_uid, params.app_version, function(apps) {
        if (apps) {
            var app = apps[0];
            app.verify(params.checksum, function(verified) {
                if (verified) {
                    app.checkCompiled(params.platform, params.checksum, function(compiled) {
                        if (compiled) {
                            utils.log("getting exec file", utils.logLevel.debug);
                            app.getExecutable(params.platform, function(file, fileName, contentType) {
                                if (file) {
                                    res.contentLength = file.length;
                                    res.contentType = contentType;
                                    res.header("Content-Disposition", 'attachment;filename=\"' + fileName + '\"');
                                    res.send(200, file);
                                }
                                else {
                                    outputError(res, 500, "Could not find executable for app");
                                }
                            });
                        }
                        else {
                            outputError(res, 500, "App is not compiled");
                        }
                    });
                }
                else {
                    outputError(res, 500, "App checksum does not match");
                }
            });
        }
        else {
            outputError(res, 500, "No app found for given ID and version");
        }
    });
    return next();
};

/*******************************************************************************
    Internal functions, not exported in module
*******************************************************************************/

/**
    Get one or more apps matching the parameters given. Traverses the app directory structure and fetches apps accordingly. If neither appUid nor appVersion if given, will return all apps in directory. If only appUid is given, will return all versions for that app. Does a callback when done, with the result.
    @param {String} appUid - ID of app. Optional.
    @param {String} appVersion - Version of app. Optional.
    @param {Function} callback - Callback function to be called when done. 
        Should accept one parameter for the array containing the apps. Required.
*/
function getApps(appUid, appVersion, callback) {
    utils.log("getApps", utils.logLevel.debug);
    var appsPath = [config.cordova_apps_path];
    if (appUid) {
        appsPath.push(appUid);
        if (appVersion) appsPath.push(appVersion);
    }
    var pathLength = appsPath.length;
    appsPath = appsPath.join(path.sep);
    fs.stat(appsPath, function(err, stat) {
        if (err || !stat.isDirectory()) return callback([]);
        // We assume both uid and version is given
        var depth = 0;
        // No uid, no version
        if (pathLength==1) depth = 2;
        // Uid, but no version
        else if (pathLength==2) depth = 1;
        // Get the paths of the directories matching
        utils.getDirs(appsPath, depth, function(appPaths) {
            if (depth==0) appPaths = [appsPath];
            var apps = [];
            // Traverse through paths
            for (var i=0, ii=appPaths.length; i<ii; i++) {
                var appPath = appPaths[i].split(path.sep);
                var appId = appPath[appPath.length-2];
                var appVersion = appPath[appPath.length-1];
                // Initialize App object
                var app = new mlabapp.App(appId, appVersion, null, function(app) {
                    apps.push(app);
                    // Only when these counters match, do we know that we are 
                    // done traversing
                    if (apps.length==appPaths.length) callback(apps);
                });
            }
        });
    });
};

/**
    Create a new Cordova app. Also writes a new config.xml file from given parameter. Does a callback with the new App object as parameter when done.
    @param {String} appUid - ID of app. Required.
    @param {String} appVersion - Version of app. Required.
    @param {String} configXML - Contents for config.xml file. Required.
    @param {Function} callback - Callback to call when done. Should accept parameter for App object created and app ID.
*/
function createNewApp(appUid, appVersion, configXML, callback) {
    utils.log("createNewApp", utils.logLevel.debug);
	var projectPath = path.join(config.cordova_apps_path, appUid); //, appVersion);
	fs.mkdir(projectPath, function(err) {
		projectPath = path.join(projectPath, appVersion);
		fs.mkdir(projectPath, function(err) { 
			// Build a list of arguments for cordova
			var args = [];
			args.push("create");
			args.push(projectPath);
			args.push(appUid);
			//args.push(appUid.split(".")[2]); // shouldn't there be an app name provided?
			// Spawn a new process for creating app. Make sure that environment, UID and 
			// GID is set correctly.
			utils.log(config.cordova_bin_path + " " + args.join(" "));
			var create = child_process.spawn(config.cordova_bin_path, args); //, {env: environment, uid: utils.getUid(), gid: utils.getGid()});
			create.on("close", function (code) {
				if (code!==0) {
					// Something went wrong
					utils.log("Cordova create: exit: " + code, utils.logLevel.error);
					return callback(null, appUid, appVersion);
				}
				// Create was successful, now fetch the app, write the config.xml file, 
				// and do callback.
				getApps(appUid, appVersion, function(apps) {
					var app = apps[0];
					app.writeConfig(configXML, function() {
						callback(app, appUid, appVersion);
					});
				});
			});
			create.stdout.on("data", function (data) {
				utils.log("stdout: " + data, utils.logLevel.debug);
			});
			create.stderr.on("data", function (data) {
				utils.log("stderr: " + data, utils.logLevel.error);
			});
		});
	});
};

/**
    Generic function to fetch a callback URL. The callback server is defined in config.callback_server.
    @param {String} callbackType - What callback to perform. Looks at CALLBACK_URIS to see what URI should be called. Allowed values: "createApp", "verifyApp", "compiledApp". Required.
    @param {Object} params - Get params to append to callback URL.
*/
function performCallback(callbackType, params) {
    utils.log("performCallback " + callbackType, utils.logLevel.debug);
    var serverUrl = config.callback_server;
    var transport = http;
    var port = 80;
    if (serverUrl.slice(0,5)==="https") {
        transport = https;
        port = 443;
    }
    var host = serverUrl.split("/")[2];
    var path = CALLBACK_URIS[callbackType] + "?" + querystring.stringify(params);
    utils.log(host + path, utils.logLevel.debug);
    var options = {
        hostname: host,
        path: path,
        port: port,
        method: "GET"
    };
    var request = transport.request(options, function(response) {
        utils.log("STATUS: " + response.statusCode, utils.logLevel.debug);
    });
    request.on("error", function(e) {
        utils.log("problem with request: " + e.message, utils.logLevel.error);
    });
    request.end();
};

/**
    Generic function to output error response through restify's response object.
    @param {Object} res - Restify response objectRequired.
    @param {Number} code - Error code. Should ideally match HTTP error codes. Optional. Default 500.
    @param {String} message - Error message. Optional. Default "Unknown error".
*/
function outputError(res, code, message) {
    if (!code) code = 500;
    if (!message) message = "Unknown error";
    res.send(code, {"code":code, "message": message});
}

/**
    Check if given passphrase matches the one we have in our config file.
    @param {Object} params - All the params given in request. Should contain "passphrase".
    @returns {Boolean} True if match, false if not.
*/
function checkPassPhrase(params) {
    var passphrase = null;
    if ("passphrase" in params) passphrase = params.passphrase
    return passphrase===config.key;
};

/**
    Do some checks and preparations common to all calls. Check if passphrase matches, returns response code 403 if not. Check if all required params are present, returns response code 500 if not. If everything is OK, returns response code 200 and params.
    @param {Object} req - Restify request objectRequired.
    @param {Array} paramNames - Array of objects. The params to return. format: [{name: <param name>, required: <boolean>}, ...]
    @returns {Array} Array with two elements: response code, and object with params.
*/
function prepareRequest(req, paramNames) {
    if (!checkPassPhrase(req.params)) {
        utils.log("bad passphrase", utils.logLevel.error);
        return [403, {}];
    }
    if (!paramNames) paramNames = [];
    var params = {};
    for (var i=0, ii=paramNames.length; i<ii; i++) {
        var paramName = paramNames[i];
        params[paramName["name"]] = paramName["name"] in req.params ? req.params[paramName["name"]] : null;
        if (paramName["required"] && params[paramName["name"]]===null) return [500, {}]
    }
    return [200, params];
}

