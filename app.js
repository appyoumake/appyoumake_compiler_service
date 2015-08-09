/**
    #MLAB Compiler Service
    
    REST API for compiling Cordova apps built with MLAB. Currently supports compiling for Android and iOS.
    
    Consists of:
        app.js - This file. Starts the server and defines routes.
        functions.js - Main function module, which binds everything together
        mlabapp.js - Module containing definition of the App object. All work on the apps are done here.
        utils.js - Module with various helper functions.
        config/config.json - Config file.
        apps/ - Directory for storing apps. This can be moved elsewhere, but make sure to edit config file accordingly.
        node_modules/ - Node.js stores modules here. Don't touch.
    
    Usage:
        Run in console:
        - node app.js
        Serve as daemon:
        - pm2 start app.js
        - pm2 stop app.js
        - pm2 restart app.js
        
        Then call API:
            GET <your server>/getAppStatus?
            POST <your server>/createApp
            GET <your server>/verifyApp?
            POST <your server>/compileApp
            GET <your server>/getApp?
    
    Docs:
    Node.js: https://nodejs.org/api/
    Restify: http://mcavage.me/node-restify/#server-api
    xmldoc: https://www.npmjs.com/package/xmldoc
    log4js: https://github.com/nomiddlename/log4js-node
    PM2: https://github.com/Unitech/pm2
    
    @author Author: Snapper Net Solutions
    @copyright Copyright (c) 2015
    @module Compiler Service

*/
/*
    Generate JSDoc:
    node_modules/.bin/jsdoc *.js -d doc/ -c config/jsdoc.json
*/

var server;
var restify = require("restify");

var utils = require("./utils.js");
var functions = require("./functions.js");

// Get config
var config = utils.getConfig();

// Create our server
server = restify.createServer({
    name : "mlabcompiler"
});

// Configure server
server.use(restify.queryParser());
server.use(restify.bodyParser({mapParams: true}));

// Set up paths
/**
    GET getAppStatus
*/
server.get({path: "/getAppStatus", version: "1"}, functions.getAppStatus);
/**
    GET createApp
*/
server.get({path: "/createApp", version: "1"}, functions.createApp);
/**
    GET verifyApp
*/
server.get({path: "/verifyApp", version: "1"}, functions.verifyApp);
/**
    POST compileApp
*/
server.get({path: "/compileApp", version: "1"}, functions.compileApp);
/**
    GET getExecChecksum
*/
server.get({path: "/getExecChecksum", version: "1"}, functions.getApp);
/**
    GET getApp
*/
server.get({path: "/getApp", version: "1"}, functions.getApp);


// Start listening
server.listen(config.port_number ,config.listen_on_ip, function(){
    utils.log(server.name + " listening at " + server.url, utils.logLevel.info, true);
});
