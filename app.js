/*
    MLAB Compiler Service

    Author: Snapper Net Solutions
    Copyright (c) 2015
    
    Consists of:
        app.js - This file. Starts the server and defines routes.
        functions.js - Main function module, which binds everything together
        mlabapp.js - Module containing definition of the App object. All work on the apps are done here.
        utils.js - Module with various helper functions.
        config/config.json - Config file.
        apps/ - Directory for storing apps. This can be moved elsewhere, but make sure to edit config file accordingly.
        node_modules/ - Node.js stores modules here. Don't touch.
    
    Usage:
        pm2 start app.js
        pm2 stop app.js
        pm2 restart app.js
        
        Then call API:
            <your server>/getAppStatus?
            <your server>/createApp?
            <your server>/verifyApp?
            <your server>/compileApp?
            <your server>/getApp?
    
    Docs:
    Node.js: https://nodejs.org/api/
    Restify: http://mcavage.me/node-restify/#server-api
    xmldoc: https://www.npmjs.com/package/xmldoc
    PM2: https://github.com/Unitech/pm2
*/

var restify = require("restify");

var utils = require("./utils.js");
var functions = require("./functions.js");

// Get config
var config = utils.getConfig();

// Create our server
var server = restify.createServer({
    name : "mlabcompiler"
});

// Configure server
server.use(restify.queryParser());
server.use(restify.bodyParser({mapParams: true}));

// Set up paths
server.get({path: "/getAppStatus", version: "1"}, functions.getAppStatus);
server.post({path: "/createApp", version: "1"}, functions.createApp);
server.get({path: "/verifyApp", version: "1"}, functions.verifyApp);
server.post({path: "/compileApp", version: "1"}, functions.compileApp);
server.get({path: "/getApp", version: "1"}, functions.getApp);


// Start listening
server.listen(config.port_number ,"localhost", function(){
    console.log("%s listening at %s ", server.name , server.url);
});