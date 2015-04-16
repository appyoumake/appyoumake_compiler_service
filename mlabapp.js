/**
    MLAB Compiler Service
    App class
    
    @author Author: Snapper Net Solutions
    @copyright Copyright (c) 2015
    @module MLAB App
*/


// Add Node modules
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var xmldoc = require("xmldoc");
var ncp = require('ncp').ncp;
ncp.limit = 16;

// Add Mlab modules
var utils = require('./utils.js');

// Get necessary things.
var environment = utils.getEnvironment();
var config = utils.getConfig();

/**
    App class. Contains all necessary information and all functions to operate on an app.
    @class
    @param {String} id - ID of app.
    @param {String} version - Version of app.
    @param {String} name - Name of app.
    @param {Function} callback - Reading the compile manifesto file is an asynchronous operation, and is done as part of the initialization of the object. If we need to wait for this to be read before we proceed, we provide a callback that is called when manifesto file is read.
*/
exports.App = function(id, version, name, callback) {
    this.id = id;
    this.version = version;
    this.name = name;
    if (!this.name) this.name = this.getNameFromConfig();
/*
    // Not sure if we are handling the multiple platform scenario correctly.
    this.platforms = {};
    for (var i=0, ii=config.platforms.length; i<ii; i++) {
        this.platforms[config.platforms[i]] = {
            compiled: false,
            compiledDate: null,
            checksum: null,
            checksumDate: null,
            checksumDate: null,
            checksumCompiled: null
        };
    }
*/
    this.compiled = false;
    this.compiledDate = null;
    this.checksum = null;
    this.checksumDate = null;
    this.checksumCompiled = null;
    
    
    // If a compilation process is already in progress, how long should we wait 
    // until we try again
    this.compile_check_interval = 1000; // 1 second
    // How long should we wait until we give up
    this.compile_check_max = 60000; // 1 minute
    // File extensions for execeutable files
    this.platform_exec_extensions = {
        "android": "apk",
        "ios": "ipa"
    };
    // Mime types for executable files
    this.platform_exec_mime_types = {
        "android": "application/vnd.android.package-archive",
        "ios": "application/octet-stream"
    };
    
    var app = this;
    // Read the compile manifesto file
    this.readCompileManifesto(function() {
        if (callback) callback(app);
    });
};

/*
    Functions for the App object.
*/
exports.App.prototype = {
    /**
        Get the base path for the app. Consists of cordova_apps_path from config, plus App's ID and version. All other paths are based on this.
        @returns {String} App's path.
    */
    getPath: function() {
        return path.join(config.cordova_apps_path, this.id, this.version);
    },

    /**
        Get the path for the lock file, used when compiling app to avoid concurrent compile jobs.
        @param {String} platform - Name of platform we are compiling for. Required.
        @returns {String} Path to lock file.
    */
    getLockFilePath: function(platform) {
        return path.join(this.getPath(), "compile-" + platform + ".lock");
    },

    /**
        Get the path for the compile menifesto file. This is a file where we keep information about the last compile.
        @returns {String} Path to compile manifesto file.
    */
    getManifestoFilePath: function() { // platform
//         return path.join(this.getPath(), "compile-" + platform + ".json");
        return path.join(this.getPath(), "compile.json");
    },

    /**
        Get the path for the Cordova config.xml file.
        @returns {String} Path to config.xml file.
    */
    getConfigFilePath: function() {
        return path.join(this.getPath(), "config.xml");
    },
    
    /**
        Get the path for the directory where executables are kept. Not to the executable itself, but the directory.
        @param {String} platform - The platform for which we want executables. Required.
        @returns {String} Path to directory.
    */
    getExecutableDirPath: function(platform) {
        var dirPath = "";
        if (platform==="android" || platform==="ios") dirPath = path.join(this.getPlatformPath(platform), "out");
        return dirPath;
    },

    getPlatformPath: function(platform) {
        return path.join(this.getPath(), "platforms", platform);
    },

    /**
        Get standardized name of executable file when returned to client.
        @param {String} platform - Platform for executable. Required.
        @returns {String} File name to be returned in response.
    */
    getExecFileName: function(platform) {
        return this.name + "-v" + this.version + "." + this.platform_exec_extensions[platform];
    },

    /**
        Calculated an md5 checksum for the www directory within the Cordova app. Does a callback with the checksum as parameter when done.
        @param {Function} callback - Callback function to call when checksum is calculated. Should accept a single parameter for checksum. Required.
    */
    getChecksum: function(callback) {
        utils.log("getChecksum", utils.logLevel.debug);
        var app = this;
        // Making a checksum from an entire directory isn't trivial. Taring to 
        // one file, and getting checksum from that.
        // http://unix.stackexchange.com/questions/35832/how-do-i-get-the-md5-sum-of-a-directorys-contents-as-one-sum
        
        // Path to temporary tar file
        var tempFilePath = path.join(process.cwd(), "temp-" + app.id  + ".tar");
        // Build argument list
        var args = [];
        args.push("-cf");
        args.push(tempFilePath);
        args.push(path.join(app.getPath(), "www"));
        // Tar the www directory to temp file
        var tar = child_process.spawn("tar", args, {env: environment, uid: utils.getUid(), gid: utils.getGid()});
        tar.on("close", function(code) {
            // If tar failed, do callback with null
            if (code!==0) return callback(null);
            // Tar went OK, now calculate md5 sum for tar file
            var md5cmd = "";
            var md5args = [tempFilePath];
            if (config.os==="linux") {
                md5cmd = "md5sum";
            }
            else if (config.os==="osx") {
                md5cmd = "md5";
            }
            var checksum = child_process.spawn(md5cmd, md5args, {env: environment, uid: utils.getUid(), gid: utils.getGid()});
            checksum.stdout.on("data", function(data) {
                data = data.toString();
                // The return value contains the file path, etc. Remove this.
                data = data.split(" ");
                data = data[data.length-1];
                data = data.trim();
                // Store the result
                app.checksum = data;
                app.checksumDate = new Date();
                // A-OK. Do callback.
                utils.log("checksum: " + data, utils.logLevel.debug);
                callback(data);
                // Remove temp file
                child_process.spawn("rm", [tempFilePath], {env: environment, uid: utils.getUid(), gid: utils.getGid()});
            });
            checksum.stderr.on("data", function (data) {
                utils.log("stderr: " + data, utils.logLevel.error);
            });
        });
        tar.stderr.on("data", function (data) {
            utils.log("stderr: " + data, utils.logLevel.error);
        });
    },
    
    /**
        Check if given checksum matches what is calculated from www directory.
        @param {String} checksum - MD5 checksum to check against. Required.
        @param {Function} callback - Callback function to call when done. Should accept a single boolean parameter indicating if checksums matched or not. Required.
    */
    verify: function(checksum, callback) {
        utils.log("verify", utils.logLevel.debug);
        this.getChecksum(function(appChecksum) {
            callback(appChecksum===checksum);
        });
    },
    
    /**
        Add platform (android, ios, etc) to Cordova app. Done "anyways". If platform has already been added, this will fail, so we are not handling errors here. If adding the platform fails otherwise (ie. if platform hasn't been set up properly on server, the paths are wrong, etc), the subsequent compile job will also fail, and you will need to do some work on your server anyway. So that's why no errors are caught here.
        @param {String} platform - Platform to add. Required.
        @param {Function} callback - Callback function called when done, always with a true parameter. Required.
    */
    addPlatform: function(platform, callback) {
        utils.log("addPlatform " + platform, utils.logLevel.debug);
        var addPlatform = child_process.spawn(config.cordova_bin_path, ["platform", "add", platform], {cwd: this.getPath(), env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()});
        addPlatform.on("close", function(code) {
            if (code!==0) utils.log("Error adding platform", utils.logLevel.error);
            callback(true);
        });
        addPlatform.stderr.on("data", function (data) {
            utils.log("stderr: " + data, utils.logLevel.error);
        });
        addPlatform.stdout.on("data", function (data) {
            utils.log("stdout: " + data, utils.logLevel.debug);
        });
    },
    
    /**
        Check if app was compiled, and if it was compiled with a contents matching the checksum given.
        @param {String} platform - Platform to check against. Required.
        @param {String} checksum - MD5 checksum to check against. Required.
        @param {Function} callback - Called when done. Should accept single boolean parameter indicating if the check was OK or not. Required.
    */
    checkCompiled: function(platform, checksum, callback) {
        utils.log("checkCompiled", utils.logLevel.debug);
        var app = this;
        app.readCompileManifesto(function(read) {
            callback(read && app.compiled && (!checksum || checksum==app.checksumCompiled));
        });
    },
    
    /**
        Wrapper function that kicks off the compile job, which may have to wait for a lock file to disappear.
        @param {String} platform - Platform to compile for. Required.
        @param {Function} callback - Called when done. Required.
    */
    compile: function(platform, callback) {
        utils.log("compile", utils.logLevel.debug);
        this.checkLockAndCompile(platform, 0, callback);
    },
    

    /**
        Checks if lock file is present for app/platform. If not, starts compilation. If it is, wait for a period, and try again. This can continue until a max time limit is reached.
        @param {String} platform - Platform to compile for. Required.
        @param {Number} timeElepased - Milliseconds since we first tried. Must be parameter for recursive use of this function. Optional.
        @param {Function} callback - Called when compile is finished, or we have met our time limit and given up. Required.
    */
    checkLockAndCompile: function(platform, timeElapsed, callback) {
        utils.log("checkLockAndCompile " + platform, utils.logLevel.debug);
        var app = this;
        if (!timeElapsed) timeElapsed = 0;
        // Check file
        fs.stat(app.getLockFilePath(platform), function(err, stat) {
            // File does not exist or is not a file. Start compilation.
            if (err || !stat.isFile()) app.doCompile(platform, callback);
            // Lock file exists.
            else {
                // Check if we have passed our timeout
                utils.log("timeElapsed: " + timeElapsed, utils.logLevel.debug);
                if (timeElapsed>=app.compile_check_max) {
                    utils.log("giving up compile, took too long", utils.logLevel.error);
                    callback(true);
                }
                // Otherwise, wait some time and try again
                else {
                    utils.log("wait for compile lock file to disappear", utils.logLevel.debug);
                    setTimeout(function() { 
                        timeElapsed += app.compile_check_interval;
                        app.checkLockAndCompile(platform, timeElapsed, callback);
                    }, app.compile_check_interval);
                }
            }
        });
    },
    
    /**
        Compile the Cordova app. Writes a lock file on start, and deletes it when finished.
        @param {String} platform - Platform to compile for. Required.
        @param {Function} callback - Called when done, with a single boolean parameter. Required.
    */
    doCompile: function(platform, callback) {
        utils.log("doCompile", utils.logLevel.debug);
        var app = this;
        // Write a lock file
        fs.writeFile(app.getLockFilePath(platform), "y");
        // Add the platform we are requesting
        app.addPlatform(platform, function(platformAdded) {
            // Do callback if platform has not been added
            if (!platformAdded) return callback(false);
            var args = ["build", platform];
            if (platform==="ios") {
                args.push("--device");
            }
            // Start compilation process
            utils.log(config.cordova_bin_path + " " + args.join(" "), utils.logLevel.debug);
            utils.log("compiling...", utils.logLevel.debug);
            var build = child_process.spawn(config.cordova_bin_path, args, {cwd: app.getPath(), env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()});
            
            // Add some listeners to compile function
            build.on("close", function(code) {
                if (platform==="android") return app.compileFinished(platform, code, callback);
                else if (platform==="ios") return app.postBuildIOS(platform, code, callback)
            });
            build.stderr.on("data", function (data) {
                utils.log("stderr: " + data, utils.logLevel.error);
            });
            build.stdout.on("data", function (data) {
                utils.log("stdout: " + data, utils.logLevel.trace);
            });
        });
    },

    XpostBuildIOS: function(platform, code, callback) {
        // For iOS apps, we need another step.
        /* 
            http://stackoverflow.com/questions/11034133/building-ios-applications-using-xcodebuild-without-codesign
            http://stackoverflow.com/questions/16445556/still-getting-cordova-cdvviewcontroller-h-file-not-found-error-in-xcode
            http://www.thecave.com/2014/09/16/using-xcodebuild-to-export-a-ipa-from-an-archive/
         */
        var app = this;
        var platformPath = app.getPlatformPath(platform);
        utils.log("copying necessary files", utils.logLevel.debug);
        utils.log(path.join(platformPath, "CordovaLib", "build") + " -> " + path.join(platformPath, "build", "."));
        ncp(path.join(platformPath, "CordovaLib", "build"), path.join(platformPath, "build", "."), function(err) {
            if (err) {
                utils.log("error copy");
                utils.log("error copy: " + err, utils.logLevel.error);
            }

            utils.log("copy ok", utils.logLevel.debug);
            var args = [];
            args.push("clean");
            args.push("build");
            args.push("-target");
            args.push(app.name);
            args.push("-sdk");
            args.push(config.ios.sdk_path);
            args.push("-configuration");
            args.push("Release");
            args.push("CODE_SIGN_IDENTITY=''");
            args.push("CODE_SIGNING_REQUIRED=NO");
            args.push(">> /dev/null"); // Kept getting error that stdout maxBuffer exceeded, so directing output to null. 
            utils.log(platformPath);
            utils.log("xcodebuild " + args.join(" "), utils.logLevel.debug);
            // For some reason, spawn wouldn't work with these arguments. So using exec instead.
            child_process.exec("xcodebuild " + args.join(" "), {cwd: platformPath, env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()}, function(err, stdout, stderr) {
                var code = 0;
                if (err) {
                    utils.log("xcodebuild error: " + err, utils.logLevel.error);
                    code = 1;
                }
                app.compileFinished(platform, code, callback);
            });

        });
    },

    postBuildIOS: function(platform, code, callback) {
        // For iOS apps, we need another step.
        /* 
            http://stackoverflow.com/questions/11034133/building-ios-applications-using-xcodebuild-without-codesign
            http://stackoverflow.com/questions/16445556/still-getting-cordova-cdvviewcontroller-h-file-not-found-error-in-xcode
            http://www.thecave.com/2014/09/16/using-xcodebuild-to-export-a-ipa-from-an-archive/
         */
        var app = this;
        var platformPath = app.getPlatformPath(platform);
        utils.log("copying necessary files", utils.logLevel.debug);
        utils.log(path.join(platformPath, "CordovaLib", "build") + " -> " + path.join(platformPath, "build", "."));
        var copyOK = false;
        ncp(path.join(platformPath, "CordovaLib", "build"), path.join(platformPath, "build", "."), function(err) {
            if (err) {
                utils.log("error copy", utils.logLevel.error);
                utils.log("error copy: " + err, utils.logLevel.error);
                return app.compileFinished(platform, 1, callback);
            }
            if (copyOK) return;
            copyOK = true;
            utils.log("copy ok", utils.logLevel.debug);
            var execOptions = {cwd: platformPath, env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()};
            
            // 1. Perform a clean on the project
            var args = [];
            args.push("-alltargets")
            args.push("-configuration");
            args.push("Release");
            args.push("clean");
            //args.push(">> /dev/null"); // Kept getting error that stdout maxBuffer exceeded, so directing output to null. 
            utils.log(platformPath);
            utils.log("xcodebuild " + args.join(" "), utils.logLevel.debug);
            var clean = child_process.spawn("xcodebuild", args, execOptions);
            clean.on("close", function(code) {
                utils.log("clean done");
                if (code!==0) return app.compileFinished(platform, code, callback);
                // 2. Export archive
                var args = [];
                args.push("-scheme");
                args.push(app.name);
                args.push("-archivePath");
                args.push(app.name + ".xcarchive");
                args.push("archive");
                args.push("CODE_SIGN_IDENTITY=''");
                args.push("CODE_SIGNING_REQUIRED=NO");
                args.push(">> /dev/null"); // Kept getting error that stdout maxBuffer exceeded, so directing output to null. 
                utils.log("xcodebuild " + args.join(" "), utils.logLevel.debug);
                // For some reason, spawn wouldn't work with these arguments. So using exec instead.
                child_process.exec("xcodebuild " + args.join(" "), execOptions, function(err, stdout, stderr) {
                    var code = 0;
                    if (err) {
                        utils.log("xcodebuild error: " + stderr, utils.logLevel.error);
                        code = 2;
                        return app.compileFinished(platform, code, callback);
                    }
                    // 3. Finally, export to .ipa file
                    var args = [];
                    args.push("-exportArchive");
                    args.push("-archivePath");
                    args.push(app.name + ".xcarchive");
                    args.push("-exportPath");
                    args.push(app.name);
                    args.push("-exportFormat");
                    args.push("ipa");
/*
                    args.push("CODE_SIGN_IDENTITY=''");
                    args.push("CODE_SIGNING_REQUIRED=NO");
*/
                    args.push("-exportProvisioningProfile");
//                     args.push('"' + config.ios.provisioning_profile + '"');
                    args.push(config.ios.provisioning_profile);
                    //args.push(">> /dev/null"); // Kept getting error that stdout maxBuffer exceeded, so directing output to null. 
                    utils.log("xcodebuild " + args.join(" "), utils.logLevel.debug);
                    var ipa = child_process.spawn("xcodebuild", args, execOptions);
                    ipa.on("close", function(code) {
                        child_process.exec("rm -rf " + app.name + ".xcarchive", execOptions, function(err, stdout, stderr) {
                            if (err) utils.log("error removing archive: " + str(err), utils.logLevel.error);
                        });
                        child_process.exec("mkdir out", execOptions, function(err, stdout, stderr) {
                            if (err) utils.log("error making dir out: " + stderr, utils.logLevel.error);
                            
                            child_process.exec("mv *.ipa out/.", execOptions, function(err, stdout, stderr) {
                                if (err) utils.log("error moving file: " + stderr, utils.logLevel.error);
                            });
                        });
                        
                        return app.compileFinished(platform, code, callback);
                    });
                    ipa.stderr.on("data", function (data) {
                        utils.log("stderr: " + data, utils.logLevel.error);
                    });
                    ipa.stdout.on("data", function (data) {
                        utils.log("stdout: " + data, utils.logLevel.trace);
                    });
                });
            });
            clean.stderr.on("data", function (data) {
                utils.log("stderr: " + data, utils.logLevel.error);
            });
            clean.stdout.on("data", function (data) {
                utils.log("stdout: " + data, utils.logLevel.trace);
            });
        });
    },

    compileFinished: function(platform, code, callback) {
        var app = this;
        // Remove lock file
        fs.unlink(app.getLockFilePath(platform));
        
        // Do false callback if we got an error
        if (code!==0) {
            utils.log("Error compiling", utils.logLevel.error);
            return callback(false);
        }
        // Save info about compilation, and write manifesto to file
        app.compiled = true;
        app.compiledDate = new Date();
        utils.log("writing manifesto", utils.logLevel.debug);
        app.writeCompileManifesto(platform, function() {
            utils.log("written");
            callback(true);
        });
    },

    /**
        Reads the compile manifesto file and stores the info in Object's attributes.
        @param {Function} callback - Called when done, or failed. Should accept 
            single boolean parameter indicating success or failure. Required.
    */
    readCompileManifesto: function(callback) {
        var app = this;
        var filePath = app.getManifestoFilePath();
        fs.readFile(filePath, function(err, data) {
            if (!err && data) {
                data = data.toString();
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

    /**
        Writes a new compile manifesto file based on info stored in Object. Overwrites any existing file.
        @param {String} platform - NOT USED for now.
        @param {Function} callback - Called when done, with true as only parameter.
    */
    writeCompileManifesto: function(platform, callback) {
        var filePath = this.getManifestoFilePath();
        var manifesto = this.output();
        fs.writeFile(filePath, JSON.stringify(manifesto), function(err) {
            callback(true);
        });
    },
    
    /**
        Get the Crodova app's actual executable file for platform.
        @param {String} platform - Platform to get file for. Required.
        @param {Function} callback - Called when done. If no file is found, callback should accept a single false parameter. If successful, callback should accept three parameters:
            - the file contents
            - the file name to be presented to client
            - the mime type for the file
    */
    getExecutable: function(platform, callback) {
        var app = this;
        var dirPath = app.getExecutableDirPath(platform);
        var extension = app.platform_exec_extensions[platform];
        var mime = app.platform_exec_mime_types[platform];
        utils.log(extension);
        utils.log(mime);
        fs.readdir(dirPath, function(err, files) {
            if (err) return callback(null);
            var execFile;
            for (var i=0, ii=files.length; i<ii; i++) {
                utils.log(files[i]);
                if (!files[i].endsWith(extension)) continue;
                utils.log("yes!");
                fs.readFile(path.join(dirPath, files[i]), function(err, data) {
                    if (err) utils.log("read file error: " + err, utils.logLevel.error);
                    if (data) {
                        var file = data.toString();
                        return callback(file, app.getExecFileName(platform), mime);
                    }
                    return callback(null);
                });
            }
        });
    },
    
    /**
        Get contents of config.xml file for Cordova app. Contents is parsed using xmldoc module.
        @returns {Object} xmldoc object
    */
    getConfig: function() {
        var filePath = this.getConfigFilePath();
        var configXML;
        try {
            if (!fs.statSync(filePath).isFile()) return null;
            configXML = fs.readFileSync(filePath, {encoding: "utf-8"});
            configXML = new xmldoc.XmlDocument(configXML);
        } catch (e) {
            utils.log(e, utils.logLevel.error);
        }
        return configXML;
    },
    
    /**
        Extract the app's name from the config.xml file.
        @returns {String} Name of the app.
    */
    getNameFromConfig: function() {
        var configXML = this.getConfig();
        return configXML ? configXML.valueWithPath("name") : "";
    },
    
    /**
        Write a new config.xml file. Will overwrite any existing file. No check is done on the contents of the file, but subsequent compile jobs will fail if this file is not correct.
        @param {String} configXML - File contents to write. Required.
        @param {Function} callback - Called when done, with App object as parameter. Required.
    */
    writeConfig: function(configXML, callback) {
        var app = this;
        fs.writeFile(app.getConfigFilePath(), configXML, function(err) {
            if (err) return callback(null);
            return callback(app);
        });
    },
    
    /**
        Output information about App object, JSON friendly.
        @returns {Object}
    */
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
    
    /**
        Convert App info to JSON, so Node.js' log displays it nicely.
        @param {Number} depth - N/A
        @param {Object} opts - N/A
        @returns {JSON}
    */
    inspect: function(depth, opts) {
        return JSON.stringify(this.output());
    }
};
