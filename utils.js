/*
    MLAB Compiler Service
    Utility functions
    
    Author: Snapper Net Solutions
    Copyright (c) 2015
*/

// Get config. To switch between development and production modes, set the environment variable "NODE_ENV" to "production" or "development".
var env = process.env.NODE_ENV || "development";
var config = require(__dirname + "/config/config.json")[env];

// Add requirements
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var http = require("http");
var https = require("https");
var querystring = require("querystring");
var xmldoc = require("xmldoc");

// Extend user"s environment variables with what was given in config
var environment = process.env;
for (key in config.environment) {
    var value = config.environment[key];
    if (value.slice(0,2)=="$:") {
        value = value.slice(1);
        if (key in environment) value = environment[key] + value;
    }
    environment[key] = value;
}

// Constants
CALLBACK_URIS = {
    "createApp": "/callback/csAppCreated",
    "verifyApp": "/callback/csAppVerified",
    "compileApp": "/callback/csAppCompiled"
};

exports.checkPassPhrase = function(params) {
    var passphrase = null;
    if ("passphrase" in params) passphrase = params.passphrase
    return passphrase===config.passphrase;
};

exports.getApps = function(appUid, appVersion, callback) {
    var appsPath = [".", "apps"];
    if (appUid) {
        appsPath.push(appUid);
        if (appVersion) appsPath.push(appVersion);
    }
    var pathLength = appsPath.length;
    appsPath = appsPath.join(path.sep)
    fs.stat(appsPath, function(err, stat) {
        if (err || !stat.isDirectory()) return callback([]);
        // We assume both uid and version is given
        var depth = 0;
        // No uid, no version
        if (pathLength==2) depth = 2;
        // Uid, but no version
        else if (pathLength==3) depth = 1;
        
        getDirs(appsPath, depth, function(appPaths) {
            if (depth==0) appPaths = [appsPath];
            var apps = [];
            for (var i=0, ii=appPaths.length; i<ii; i++) {
                var appPath = appPaths[i].split(path.sep);
                var appId = appPath[2];
                var appVersion = appPath[3];
                var app = new App(appUid, appVersion);
                
                // TODO: Check if compiled and when
                apps.push(app);
            }
            return callback(apps);
        });
    });
};

exports.createNewApp = function(appUid, appVersion, callback) {
    console.log("createNewApp");
    var args = [];
    args.push("create");
    args.push(path.join(process.cwd(), "apps", appUid, appVersion));
    args.push(appUid);
    args.push(appUid.split(".")[2]); // shouldn"t there be an app name provided?
    var create = child_process.spawn(config.cordova, args, {env: environment});
    create.on("close", function (code) {
        if (code!==0) {
            console.log("Cordova create: exit: " + code);
            callback(null);
        }
        exports.getApps(appUid, appVersion, callback);
    });
    create.stdout.on("data", function (data) {
        console.log("stdout: " + data);
    });

    create.stderr.on("data", function (data) {
        console.log("stderr: " + data);
    });
};

exports.performCallback = function(callbackType, params) {
    console.log("performCallback " + callbackType);
    var serverUrl = config.callback_server;
    var transport = http;
    var port = 80;
    if (serverUrl.slice(0,5)==="https") {
        transport = https;
        port = 443;
    }
    var host = serverUrl.split("/")[2];
    var path = CALLBACK_URIS[callbackType] + "?" + querystring.stringify(params);
    console.log(host+path);
    var options = {
        hostname: host,
        path: path,
        port: port,
        method: "GET"
    };
    var request = transport.request(options, function(response) {
        console.log("STATUS: " + response.statusCode);
        console.log("HEADERS: " + JSON.stringify(response.headers));
    });
    request.on("error", function(e) {
        console.log("problem with request: " + e.message);
    });
};


function App(id, version, name, callback) {
    this.id = id;
    this.version = version;
    this.name = name;
    if (!this.name) this.name = this.getNameFromConfig();
    
    this.compiled = false;
    this.compiledDate = null;
    this.checksum = null;
    this.checksumDate = null;
    this.checksumCompiled = null;
    
    var app = this;
    this.readCompileManifesto(function() {
        if (callback) callback(app);
    });
};

App.prototype = {
    getPath: function() {
        return path.join(process.cwd(), "apps", this.id, this.version);
    },
    
    getChecksum: function(callback) {
        console.log("getChecksum");
        var app = this;
        var tempFilePath = path.join(process.cwd(), "temp-" + app.id  + ".tar");
        var args = [];
        args.push("-cf");
        args.push(tempFilePath);
        args.push(path.join(app.getPath(), "www"));
        // Making a checksum from an entire directory isn"t trivial. Taring to one file, and getting checksum from that.
        // http://unix.stackexchange.com/questions/35832/how-do-i-get-the-md5-sum-of-a-directorys-contents-as-one-sum
        var tar = child_process.spawn("tar", args, {env: environment});
        tar.on("close", function(code) {
            if (code!==0) callback(null);
            var checksum = child_process.spawn("md5sum", [tempFilePath], {env: environment});
            checksum.stdout.on("data", function(data) {
                data = ""+data;
                data = data.replace(tempFilePath, "");
                data = data.trim();
                app.checksum = data;
                app.checksumDate = new Date();
                callback(data);
                // Remove temp file
                child_process.spawn("rm", [tempFilePath], {env: environment});
            });
            checksum.stderr.on("data", function (data) {
                console.log("stderr: " + data);
            });
        });
        tar.stderr.on("data", function (data) {
            console.log("stderr: " + data);
        });
    },
    
    verify: function(checksum, callback) {
        console.log("verify");
        this.getChecksum(function(appChecksum) {
            callback(appChecksum===checksum);
        });
    },
    
    addPlatform: function(platform, callback) {
        console.log("addPlatform");
        var addPlatform = child_process.spawn("cordova", ["platform", "add", platform], {cwd: this.getPath(), env: environment});
        addPlatform.on("close", function(code) {
            if (code!==0) console.log("Error adding platform");
            callback(true);
        });
        addPlatform.stderr.on("data", function (data) {
            console.log("stderr: " + data);
        });
        addPlatform.stdout.on("data", function (data) {
            console.log("stdout: " + data);
        });
    },
    
    checkCompiled: function(checksum, callback) {
        console.log("checkCompiled");
        var app = this;
        app.readCompileManifesto(function(read) {
            callback(read && app.compiled && (!checksum || checksum==app.checksumCompiled));
        });
    },
    
    compile: function(platform, callback) {
        var app = this;
        app.addPlatform(platform, function(platformAdded) {
            if (!platformAdded) return callback(false);
            var compile = child_process.spawn("cordova", ["build"], {cwd: app.getPath(), env: environment});
            compile.on("close", function(code) {
                if (code!==0) {
                    console.log("Error compiling");
                    callback(false);
                }
                app.compiled = true;
                app.compiledDate = new Date();
                app.writeCompileManifesto(function() {
                    callback(true);
                });
            });
            compile.stderr.on("data", function (data) {
                console.log("stderr: " + data);
            });
            compile.stdout.on("data", function (data) {
                console.log("stdout: " + data);
            });
        });
    },
    
    readCompileManifesto: function(callback) {
        var app = this;
        var filePath = path.join(this.getPath(), "compile.json");
        fs.readFile(filePath, function(err, data) {
            data = ""+data;
            if (!err && data) {
                var manifesto = JSON.parse(data);
                if (manifesto.id===app.id && manifesto.version===app.version) {
                    app.compiled = manifesto.compiled;
                    app.compiledDate = manifesto.compiledDate;
                    app.checksumCompiled = manifesto.checksum;
                }
                callback(true);
            }
            else callback(false);
        });
    },

    writeCompileManifesto: function(callback) {
        var filePath = path.join(this.getPath(), "compile.json");
        var manifesto = this.output();
        fs.writeFile(filePath, JSON.stringify(manifesto), function(err) {
            callback(true);
        });
    },
    
    getConfig: function() {
        var filePath = path.join(this.getPath(), "config.xml");
        if (!fs.statSync(filePath).isFile()) return null;
        var configXML = fs.readFileSync(filePath, {encoding: "utf-8"});
        configXML = new xmldoc.XmlDocument(configXML);
        
        return configXML;
    },
    
    getNameFromConfig: function() {
        var configXML = this.getConfig();
        return configXML ? configXML.valueWithPath("name") : "";
    },
    
    output: function() {
        return {
            id: this.id, 
            version: this.version, 
            name: this.name, 
            compiled: this.compiled, 
            compiledDate: this.compiledDate,
            checksum: this.checksum,
            checksumDate: this.checksumDate
        }
    },
    
    inspect: function(depth, opts) {
        return JSON.stringify(this.output());
    }
};



/* Internal utilities, that need not be exported */

function getDirs(basePath, depth, callback, dirs) {
    if (!dirs) dirs = []
    if (!depth) return callback(dirs);
    fs.readdir(basePath, function(err, files) {
        for (var i=0, ii=files.length; i<ii; i++) {
            dirPath = path.join(basepath, files[i]);
            fs.stat(dirPath, function(err ,stat) {
                if (err || !stat.isDirectory()) return
                if (depth==1) dirs.push(dirPath);
                else getDirs(dirPath, depth-1, callback, dirs);
            });
        }
    });
};

