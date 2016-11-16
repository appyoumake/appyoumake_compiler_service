/*******************************************************************************************************************************
@copyright Copyright (c) 2013-2016, Norwegian Defence Research Establishment (FFI) - All Rights Reserved

@license Proprietary and confidential

@author Arild Bergh/Sinett 3.0 programme (firstname.lastname@ffi.no) 

Unauthorized copying of this file, via any medium is strictly prohibited 

For the full copyright and license information, please view the LICENSE_MLAB file that was distributed with this source code.
*******************************************************************************************************************************/
/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
    /**
        Platform specific build/compile function for iOS, called post Cordova build. Most of the work is actually done in /bin/compileios.sh.
        @param {String} platform - Platform to compile for. Required.
        @param {Number} code - Return code from Cordova build process.
        @param {Function} callback - Called when done, with the same parameters as this. Required.

    */
function postBuild (app, config, platform, code, callback) {
    // For iOS apps, we need another step.
    var platformPath = app.getPlatformPath(platform);
    var execOptions = {env: utils.getEnvironment(platform), uid: utils.getUid(), gid: utils.getGid()};
    utils.log("Starting compile process for " + app.name, utils.logLevel.debug);
    utils.log("./bin/compileios.sh " + [platformPath, "'" + app.name + "'", "'" + config.ios.provisioning_profile + "'"].join(" "));
    var compile = child_process.spawn("./bin/compileios.sh", [platformPath, app.name, config.ios.provisioning_profile], execOptions);
    compile.on("close", function(code) {
        utils.log("compile: " + code);
        if (code!==0) return app.compileFinished(platform, code, callback);
        execOptions["cwd"] = platformPath;
        child_process.exec("mkdir out", execOptions, function(err, stdout, stderr) {
            if (err) utils.log("error making dir out: " + stderr, utils.logLevel.error);

            child_process.exec("mv *.ipa out/.", execOptions, function(err, stdout, stderr) {
                if (err) utils.log("error moving file: " + stderr, utils.logLevel.error);
                return app.compileFinished(platform, code, callback);
            });
        });
    });
    compile.stderr.on("data", function (data) {
        utils.log("stderr: " + data, utils.logLevel.error);
    });
    compile.stdout.on("data", function (data) {
        utils.log("stdout: " + data, utils.logLevel.trace);
    });
}