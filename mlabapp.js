/*******************************************************************************************************************************
@copyright Copyright (c) 2013-2016, Norwegian Defence Research Establishment (FFI) - All Rights Reserved

@license Proprietary and confidential

@author Morten Krane (Snapper) - first version 
@author Arild Bergh/Sinett 3.0 programme (firstname.lastname@ffi.no) additional functionality, bug fixes

Unauthorized copying of this file, via any medium is strictly prohibited 

For the full copyright and license information, please view the LICENSE_MLAB file that was distributed with this source code.
*******************************************************************************************************************************/
/**
    MLAB Compiler Service
    App class
    
    @module MLAB App
*/


// Add Node modules
var fs = require("fs");
var md5File = require("md5-file");
var md5 = require("md5");
var path = require("path");
var child_process = require("child_process");
var xmldoc = require("xmldoc");
var xml2js = require("xml2js");

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
    @param {Function} callback - Reading the compile manifesto file is an asynchronous operation, and is done as part of the initialization of the object. 
                                 If we need to wait for this to be read before we proceed, we provide a callback that is called when manifesto file is read.
*/
exports.App = function(id, version, name, callback) {
    this.id = id;
    this.version = version;
    this.name = name;
    if (!this.name) this.name = this.getNameFromConfig();

    this.platforms = {};
    for (var i=0, ii=config.platforms.length; i<ii; i++) {
        this.platforms[config.platforms[i]] = {
            compiled: false,
            compiledDate: null,
            checksumCompiledSource: null,
            checksumCompiledExecutable: null
        };
    }
    this.checksum = null;
    this.checksumDate = null;

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

    getInboxPath: function() {
        return path.join(config.inbox_path, this.id, this.version);
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
        dirPath = path.join(this.getPlatformPath(platform), config[platform].executable_path)
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
        return this.name + "-v" + this.version + "." + config[platform].executable_extension;
    },

    /**
        Calculated an md5 checksum for the www directory within the Cordova app. Does a callback with the checksum as parameter when done.
        The calculation is as follows: generate checksum for each file in folder, including subfolders. Store in array, sort array, then merge into single sting, and MD5 that.
        @param {Function} callback - Callback function to call when checksum is calculated. Should accept a single parameter for checksum. Required.
    */
    getChecksum: function(callback) {
        utils.log("getChecksum", utils.logLevel.debug);
        var app = this;
        
        var app_path = path.join(app.getInboxPath());
        
        utils.walkDir(app_path, config.exclude_from_checksum, function(err, results) {
            if (err) throw err;
            var md5sums = [];
            for (i in results) {
                md5sums.push(md5File(results[i]));
            }

            md5sums.sort();
            var global_md5 = md5(md5sums.join(""));
            
            app.checksum = global_md5;
            app.checksumDate = new Date();
//Got checksum, do callback.
            utils.log("checksum: " + global_md5, utils.logLevel.debug);
            callback(global_md5);

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
            utils.log("verifying checksum " + appChecksum + " vs. " + checksum, utils.logLevel.debug);
            callback(appChecksum===checksum, appChecksum);
        });
    },


    symlinkProjectSource: function(){
        /**
         Creates symlink from www folder in rsync inbox to cordova project folder
         */

        utils.log("Creating symlink", utils.logLevel.debug);

        // Setup dyn link between inbox and cordova working folder
        var source = path.join(this.getInboxPath(), 'www');
        var target = path.join(this.getPath(), 'www');

        //TODO check if rsync folder is empty: if empty, move www folder from cordova to rsync folder, if not delete www folder in cordova before symlinking
        fs.rename(target, source, function(err) {
            if(err) utils.log("Error moving www folder before creating symlink" + err.message, utils.logLevel.error);

            fs.symlink(source, target, "dir", function (err) {
                if (err) utils.log("Error creating symlink " + err.message, utils.logLevel.error);
                //FIX handle different errors
            });

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
        //var addPlatform = child_process.spawn(config.cordova_bin_path, ["platform", "add", platform], {cwd: this.getPath(), uid: utils.getUid()});

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
            utils.log(platform);
            utils.log("read: " + read);
            utils.log(app);
            utils.log(app.platforms);
            callback(read && app.platforms[platform].compiled && (!checksum || checksum===app.platforms[platform].checksumCompiledSource));
        });
    },
    
    /**
     * Update the config.xml file of the project. In this part we only do global actions
     *  1: icon.png and splash.* are moved to a res folder inside the project (not created by Cordova, so must add this)
     *  2: Update the title of the project.
     *  3: install plugins required
     * 
     * 
     * For platform specific updates, such as adding permissions etc, we use the preBuild functions in platform specific prebuild javascript files
     */
    prepareConfiguration: function(platform, compile_callback) {
        utils.log("Prepare configuration for " + platform, utils.logLevel.debug);
        var app = this;
        var app_path = app.getPath();
        var res_path = path.join(app_path, "res");
        var config_path = app.getConfigFilePath();
        var sourcecode_path = app.getInboxPath();
        var xml_root = "widget";
        var mlab_app_config_filename = config.filenames.mlab_app_config;
        if (typeof mlab_app_config_filename == 'undefined') utils.log("filename.mlab_app_config not defined in config");
        var mlab_app_config = JSON.parse(fs.readFileSync(sourcecode_path + "/" + mlab_app_config_filename, 'utf8'));

//need to create a res folder, nodejs is not too cool about checking for file existence, need a try/catch
        try {
            fs.mkdirSync(res_path);
        } catch (e) {
        }
        
    //first we install the plugins specified. This has to go first as the external calls to cordova CLI commands will update the config.xml file
        if (typeof mlab_app_config.plugins != "undefined" && mlab_app_config.plugins.length > 0) {
            console.log("Installing plugins");
            var temp_args = ["plugin", "add"];
            var args = temp_args.concat(mlab_app_config.plugins);
            var build = child_process.spawnSync(config.cordova_bin_path, args, {cwd: app.getPath(), env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()});
        }


//read in main config file into a JS object, if OK we update values in it befor storing it
//(multiple tags with same name = [], attributes are stored in {$} object and text nodes (i.e. content of tag) are stored in {_} }
        utils.xmlFileToJs(config_path, function (err, data) {
            if (err) throw (err);
            utils.log("Updating config.xml", utils.logLevel.debug);
         
//update title
            data[xml_root]["name"] = [mlab_app_config.title];
            
//TODO check for error here
//copy icon, will always exist
            fs.writeFileSync(path.join(res_path, config.filenames.icon), fs.readFileSync(path.join(sourcecode_path, config.filenames.icon)));
            data[xml_root]["icon"] = { "$": { "src": "res/icon.png" }};
            
//copy splash screen, may or may not exist, and it may have .jpg or .png extension
            if (typeof config.filenames.splash_ext != "undefined") {
                for (var i = 0, ii = config.filenames.splash_ext.length; i < ii; i++) {
                    var source_path = path.join(sourcecode_path, config.filenames.splashscreen) + "." + config.filenames.splash_ext[i];
                    var dest_path = path.join(res_path, config.filenames.splashscreen) + "." + config.filenames.splash_ext[i];
                    try {
                        fs.writeFileSync(dest_path, fs.readFileSync(source_path));
                        utils.log("Copied splash screen", utils.logLevel.debug);
                    } catch (e) {
                        utils.log("No splash screen to copy", utils.logLevel.debug);
                    }
                }
            }

//finally we run the prebuild code specific to each platform.
//This may contain anything, but a key thing to begin with is the splash screen which requires a lot of different entries in local config files.
            try {
                var platform_pre_code = require("./preBuild_" + platform.toLowerCase() + ".js");
                platform_pre_code.preBuild (app, config, platform, code, args, data);
            } catch (e) {
                if ( e.code === 'MODULE_NOT_FOUND' ) {
                    utils.log("No prebuild available for " + platform, utils.logLevel.debug);
                }
            }
            
//finished updating config, now we'll save the file
            utils.log("Updating config.xml file for app", utils.logLevel.debug);
            utils.jsToXmlFile(config_path, data, function (err) {
                if (err) {
                    utils.log("Updating failed", utils.logLevel.debug);
                    console.log(err);
                } else {
                    utils.log("Updating successful", utils.logLevel.debug);
                    compile_callback();
                }

            })
        });

    },
    
    /**
        Wrapper function that kicks off the compile job, which may have to wait for a lock file to disappear.
        If lock file is older than 
        @param {String} platform - Platform to compile for. Required.
        @param {Function} callback - Called when done. Required.
    */
    compile: function(platform, callback) {
        utils.log("compile", utils.logLevel.debug);
        var app = this;
        var lock_filename = app.getLockFilePath(platform);

// Remove stale lock file
        try {
            var lockinfo = fs.statSync(lock_filename);
            var endTime, now;
            now = new Date().getTime();
            endTime = new Date(lockinfo.mtime).getTime() + (config.compile_lock_timeout * 1000);
            if (now > endTime) {
                utils.log("Removing lock file", utils.logLevel.debug);
                fs.unlink(lock_filename);
                utils.log("Deleted old lock file", utils.logLevel.debug);
            }
        } catch (e) {
            utils.log("No lock file", utils.logLevel.debug);
        }

        utils.checkFileAndDo(app.getLockFilePath(platform), config.compile_check_interval, config.compile_check_max, "notexists", function(success) {
            if (!success) {
                callback(true);
            } else {
                app.doCompile(platform, callback);
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

//if there is a prebuild module available we load it an run the only function in it, which should be called postBuild
            app.prepareConfiguration(platform, function() {

// Prepare app for compilation
                var args = ["prepare", platform];
                utils.log("Command: " + config.cordova_bin_path + " " + args.join(" "), utils.logLevel.debug);
                try {
                    var cordova_prepare = child_process.spawn(config.cordova_bin_path, args, {cwd: app.getPath(), env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()});

                    cordova_prepare.on("close", function(code) {
                        utils.log("Done preparing", utils.logLevel.debug);
                    });
                } catch (e) {
                    utils.log(e, utils.logLevel.error);
                };

// Start compilation process
                var args = ["compile", platform];
                utils.log("Starting actual compilation using Cordova...", utils.logLevel.debug);
                utils.log("Command: " + config.cordova_bin_path + " " + args.join(" "), utils.logLevel.debug);
                try {
                    var build = child_process.spawn(config.cordova_bin_path, args, {cwd: app.getPath(), env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()});
            
// Add some listeners to compile function
                    build.on("close", function(code) {
                        utils.log("Compilation process ended, see output above for results", utils.logLevel.debug);
//if there is a postbuild module available we load it and run the only function in it, which should be called postBuild
                        try {
                            utils.log("Attempting to run post build code for " + platform, utils.logLevel.debug);
                            var platform_post_code = require("./postBuild_" + platform.toLowerCase() + ".js");
                            return platform_post_code.postBuild (app, platform, code, callback);
                        } catch (e) {
                            if ( e.code === 'MODULE_NOT_FOUND' ) {
                                utils.log("No post build code to run for " + platform, utils.logLevel.debug);
                            } else {
                                utils.log("Unknown post build code error for " + platform, utils.logLevel.debug);
                            }
                            return app.compileFinished(platform, code, callback); 

                        }
                    });
                    
                    build.stderr.on("data", function (data) {
                        utils.log("stderr: " + data, utils.logLevel.error);
                    });

                    build.stdout.on("data", function (data) {
                        utils.log("stdout: " + data, utils.logLevel.trace);
                    });

                } catch (e) {
                    utils.log(e, utils.logLevel.error);

// Remove lock file
                    utils.log("Removing lock file", utils.logLevel.debug);
                    fs.unlink(app.getLockFilePath(platform));
//TODO add callback to indicate failed
                }
            });


        });
    },


    /**
        Function called when build and compile operations are finished. Removes lock file, writes compile manifesto, and calls callback.
        @param {String} platform - Platform to compile for. Required.
        @param {Number} code - Return code from Cordova build process.
        @param {Function} callback - Called when done, with a single boolean parameter. Required.
    */
    compileFinished: function(platform, code, callback) {
        var app = this;
// Remove lock file
        utils.log("Removing lock file", utils.logLevel.debug);
        fs.unlink(app.getLockFilePath(platform));
        
        // Do false callback if we got an error
        if (code!==0) {
            utils.log("Error compiling", utils.logLevel.error);
            return callback(false);
        }
        // Save info about compilation, and write manifesto to file
        app.platforms[platform].compiled = true;
        app.platforms[platform].compiledDate = new Date();
        app.platforms[platform].checksumCompiledSource = app.checksum;
        app.platforms[platform].checksumCompiledExecutable = app.getExecutableChecksum(platform);
        utils.log("writing manifesto", utils.logLevel.debug);
        app.writeCompileManifesto(function() {
            callback(true);
        });
    },

    /**
        Reads the compile manifesto file and stores the info in Object's attributes.
        @param {Function} callback - Called when done, or failed. Should accept single boolean parameter indicating success or failure. Required.
    */
    readCompileManifesto: function(callback) {
        var app = this;
        var filePath = app.getManifestoFilePath();
        fs.readFile(filePath, function(err, data) {
            if (!err && data) {
                data = data.toString();
                var manifesto = JSON.parse(data);
                if (manifesto.id===app.id && manifesto.version===app.version) {
                    app.platforms = manifesto.platforms;
                }
                callback(true);
            }
            else callback(false);
        });
    },

    /**
        Writes a new compile manifesto file based on info stored in Object. Overwrites any existing file.
        @param {Function} callback - Called when done, with true as only parameter.
    */
    writeCompileManifesto: function(callback) {
        var filePath = this.getManifestoFilePath();
        var manifesto = this.output();
        fs.writeFile(filePath, JSON.stringify(manifesto), function(err) {
            callback(true);
        });
    },
    
    /**
        Gets the compile info, either for specific platform, or for all platforms.
        @param {String} platform - Platform we want info for. If omitted, will return info for all defined (in config) platforms.
        @returns {Object} Platform compile info
    */
    getCompiledInfo: function(platform) {
        var compiledInfo = {};
        if (platform) {
            if (platform in this.platforms) {
                compiledInfo = {};
                compiledInfo[platform] = this.platforms[platform];
            }
        }
        else {
            compiledInfo = this.platforms;
        }
        return compiledInfo;
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
        var extension = config[platform].executable_extension;
        var mime = config[platform].executable_mime_type;
        utils.log(extension);
        utils.log(mime);
        var filePath = app.getExecutableDirPath(platform) + "/" + config[platform].executable_filename + "." + config[platform].executable_extension;
        utils.log("File to download: " + filePath);
        if (fs.existsSync(filePath)) {
            fs.readFile(filePath, function(err, data) {
                if (err) {
                    utils.log("read file " + filePath + " error: " + err, utils.logLevel.error);
                }
                if (data) {
                    //var file = data.toString();
                    return callback(data, app.getExecFileName(platform), mime);
                }
                return callback(null);
            });
        }
    },
    
/**
 * Finds executable file for relevant platform and returns checksum
 * @param {type} platform
 * @returns {Boolean}
 */
    getExecutableChecksum: function(platform) {
        utils.log("getExecutableChecksum", utils.logLevel.debug);
        var app = this;
        var filePath = app.getExecutableDirPath(platform) + "/" + config[platform].executable_filename + "." + config[platform].executable_extension;
        utils.log("filepath = " + filePath, utils.logLevel.debug);
        return md5File(filePath);
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
    
    updateConfigTag: function (configXML, tag, value) {
        
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
        var ob = {
            id: this.id, 
            version: this.version, 
            name: this.name,
            platforms: this.getCompiledInfo()
        };
        return ob;
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
