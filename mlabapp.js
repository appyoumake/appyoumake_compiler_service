/*
    MLAB Compiler Service
    App class
    
    Author: Snapper Net Solutions
    Copyright (c) 2015
*/

// Add Node modules
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var xmldoc = require("xmldoc");

// Add Mlab modules
var utils = require('./utils.js');

// Get necessary things.
var environment = utils.getEnvironment();
var config = utils.getConfig();

/*
    App object. Contains all necessary information and all functions to operate 
    on an app.
    @param id: String. ID of app.
    @param version: String. Version of app.
    @param name: String. Name of app.
    @param callback: Function. Reading the compile manifesto file is an 
        asynchronous operation, and is done as part of the initialization of 
        the object. If we need to wait for this to be read before we proceed, 
        we provide a callback that is called when manifesto file is read.
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
        "android": "apk"
    };
    // Mime types for executable files
    this.platform_exec_mime_types = {
        "android": "application/vnd.android.package-archive"
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
    /*
        Get the base path for the app. Consists of cordova_apps_path from 
        config, plus App's ID and version. All other paths are based on this.
        @return: String. App's path.
    */
    getPath: function() {
        return path.join(config.cordova_apps_path, this.id, this.version);
    },

    /*
        Get the path for the lock file, used when compiling app to avoid
        concurrent compile jobs.
        @param platform: String. Name of platform we are compiling for. Required.
        @return: String: Path to lock file.
    */
    getLockFilePath: function(platform) {
        return path.join(this.getPath(), "compile-" + platform + ".lock");
    },

    /*
        Get the path for the compile menifesto file. This is a file where we 
        keep information about the last compile.
        @return: String path to compile manifesto file.
    */
    getManifestoFilePath: function() { // platform
//         return path.join(this.getPath(), "compile-" + platform + ".json");
        return path.join(this.getPath(), "compile.json");
    },

    /*
        Get the path for the Cordova config.xml file.
        @return: String. Path to config.xml file.
    */
    getConfigFilePath: function() {
        return path.join(this.getPath(), "config.xml");
    },
    
    /*
        Get the path for the directory where executables are kept. Not to the 
        executable itself, but the directory.
        @param platform: String. The platform for which we want executables. 
            Required.
        @return: String. Path to directory.
    */
    getExecutableDirPath: function(platform) {
        return path.join(this.getPath(), "platforms", platform, "out");
    },

    /*
        Get standardized name of executable file when returned to client.
        @param platform: String. Platform for executable. Required.
        @return String. File name to be returned in response.
    */
    getExecFileName: function(platform) {
        return this.name + "-v" + this.version + "." + this.platform_exec_extensions[platform];
    },

    /*
        Calculated an md5 checksum for the www directory within the Cordova app. 
        Does a callback with the checksum as parameter when done.
        @param callback: Function. Callback function to call when checksum is 
            calculated. Should accept a single parameter for checksum. Required.
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
            var checksum = child_process.spawn("md5sum", [tempFilePath], {env: environment, uid: utils.getUid(), gid: utils.getGid()});
            checksum.stdout.on("data", function(data) {
                data = data.toString();
                // The return value contains the file path. Remove this.
                data = data.replace(tempFilePath, "");
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
    
    /*
        Check if given checksum matches what is calculated from www directory.
        @param checksum: String. MD5 checksum to check against. Required.
        @param callback: Function. Callback function to call when done. Should.
            accept a single boolean parameter indicating if checksums matched or
            not. Required.
    */
    verify: function(checksum, callback) {
        utils.log("verify", utils.logLevel.debug);
        this.getChecksum(function(appChecksum) {
            callback(appChecksum===checksum);
        });
    },
    
    /*
        Add platform (android, ios, etc) to Cordova app. Done "just in case". 
        If platform already exists, this will fail, so we are not handling 
        errors here. If adding the platform fails otherwise, the subsequent 
        compile job will also fail, and you will need to do some work on your 
        server anyway.
        @param platform: String. Platform to add. Required.
        @param callback: Function. Callback function called when done, always,
            with a true parameter. Required.
    */
    addPlatform: function(platform, callback) {
        utils.log("addPlatform", utils.logLevel.debug);
        var addPlatform = child_process.spawn(config.cordova_bin_path, ["platform", "add", platform], {cwd: this.getPath(), env: environment, uid: utils.getUid(), gid: utils.getGid()});
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
    
    /*
        Check if app was compiled, and if it was compiled with a contents 
        matching the checksum given.
        @param platform: String. Platform to check against. Required.
        @param checksum: String. MD5 checksum to check against. Required.
        @param callback: Function. Called when done. Should accept single 
            boolean parameter indicating if the check was OK or not. Required.
    */
    checkCompiled: function(platform, checksum, callback) {
        utils.log("checkCompiled", utils.logLevel.debug);
        var app = this;
        app.readCompileManifesto(function(read) {
            callback(read && app.compiled && (!checksum || checksum==app.checksumCompiled));
        });
    },
    
    /*
        Wrapper function that kicks off the compile job, which may have to wait 
        for a lock file to disappear.
        @param platform: Platform to compile for. Required.
        @param callback: Function. Called when done. Required.
    */
    compile: function(platform, callback) {
        utils.log("compile", utils.logLevel.debug);
        this.checkLockAndCompile(platform, 0, callback);
    },
    

    /*
        Checks if lock file is present for app/platform. If not, starts 
        compilation. If it is, wait for a period, and try again. This can 
        continue until a max time limit is reached.
        @param platform: String. Platform to compile for. Required.
        @param timeElepased: Number. Milliseconds since we first tried. Must be 
            parameter for recursive use of this function. Optional.
        @param callback: Function. Called when compile is finished, or we have 
            met our time limit and given up. Required.
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
    
    /*
        Compile the Cordova app. Writes a lock file on start, and deletes it 
        when finished.
        @param platform: String. Platform to compile for. Required.
        @param callback: Function. Called when done, with a single boolean 
            parameter. Required.
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
            // Start compilation process
            utils.log("compiling...", utils.logLevel.debug);
            var compile = child_process.spawn(config.cordova_bin_path, ["build"], {cwd: app.getPath(), env: environment, uid: utils.getUid(), gid: utils.getGid()});
    
            
            // Add some listeners to compile function
            compile.on("close", function(code) {
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
                    callback(true);
                });
            });
            compile.stderr.on("data", function (data) {
                utils.log("stderr: " + data, utils.logLevel.error);
            });
            compile.stdout.on("data", function (data) {
                //utils.log("stdout: " + data, utils.logLevel.trace);
            });
        });
    },
    
    /*
        Reads the compile manifesto file and stores the info in Object's 
        attributes.
        @param callback: Function. Called when done, or failed. Should accept 
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

    /*
        Writes a new compile manifesto file based on info stored in Object. 
        Overwrites any existing file.
        @param platform: String. NOT USED for now.
        @param callback: Function. Called when done, with true as only 
            parameter.
    */
    writeCompileManifesto: function(platform, callback) {
        var filePath = this.getManifestoFilePath();
        var manifesto = this.output();
        fs.writeFile(filePath, JSON.stringify(manifesto), function(err) {
            callback(true);
        });
    },
    
    /*
        Get the Crodova app's actual executable file for platform.
        @param platform: String. Platform to get file for. Required.
        @param callback: Function. Called when done. If no file is found, 
            callback should accept a single false parameter. If successful, 
            callback should accept three parameters:
            - the file contents
            - the file name to be presented to client
            - the mime type for the file
    */
    getExecutable: function(platform, callback) {
        var app = this;
        var dirPath = app.getExecutableDirPath(platform);
        var extension = app.platform_exec_extensions[platform];
        var mime = app.platform_exec_mime_types[platform];
        fs.readdir(dirPath, function(err, files) {
            if (err) return callback(null);
            var execFile;
            for (var i=0, ii=files.length; i<ii; i++) {
                if (!files[i].endsWith(extension)) continue;
                fs.readFile(path.join(dirPath, files[i]), function(err, data) {
                    if (data) {
                        var file = data.toString();
                        return callback(file, app.getExecFileName(platform), mime);
                    }
                    return callback(null);
                });
            }
        });
    },
    
    /*
        Get contents of config.xml file for Cordova app. Contents is parsed 
        using xmldoc module.
        @return: xmldoc Object.
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
    
    /*
        Extract the app's name from the config.xml file.
        @return: String. Name of the app.
    */
    getNameFromConfig: function() {
        var configXML = this.getConfig();
        return configXML ? configXML.valueWithPath("name") : "";
    },
    
    /*
        Write a new config.xml file. Will overwrite any existing file. No check 
        is done on the contents of the file, but subsequent compile jobs will 
        fail if this file is not correct.
        @param configXML: String. File contents to write. Required.
        @param callback: Function. Called when done, with App object as 
            parameter. Required.
    */
    writeConfig: function(configXML, callback) {
        var app = this;
        fs.writeFile(app.getConfigFilePath(), configXML, function(err) {
            if (err) return callback(null);
            return callback(app);
        });
    },
    
    /*
        Output information about App object, JSON friendly.
        @return: Object.
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
    
    /*
        Convert App info to JSON, so Node.js' log displays it nicely.
        @param depth: N/A
        @param opts: N/A
        @return: JSON object.
    */
    inspect: function(depth, opts) {
        return JSON.stringify(this.output());
    }
};

/*
    Helper function for check the ends of strings.
*/
if (typeof String.prototype.endsWith != 'function') { String.prototype.endsWith = function (str){
    try { return this.slice(-str.length) == str; }
    catch(e) { return false; }
};}