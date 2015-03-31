/*
    MLAB Compiler Service

    Author: Snapper Net Solutions
    Copyright (c) 2015
    
    Docs:
    Node.js: https://nodejs.org/api/
    Restify: http://mcavage.me/node-restify/#server-api
*/

var env = process.env.NODE_ENV || "development";
var restify = require('restify');

var config = require(__dirname + '/config/config.json')[env];
var functions = require('./functions.js');

// Create our server
var server = restify.createServer({
    name : "mlabcompiler"
});

// Configure server
server.use(restify.queryParser());
server.use(restify.bodyParser());

// Set up paths

server.get({path: "/getAppStatus", version: "1"}, functions.getAppStatus);
//server.post({path: "/createApp", version: "1"}, functions.createApp);
server.get({path: "/createApp", version: "1"}, functions.createApp);
server.get({path: "/verifyApp", version: "1"}, functions.verifyApp);
server.get({path: "/compileApp", version: "1"}, functions.compileApp);
// server.post({path: "/compileApp", version: "1"}, functions.compileApp);
server.get({path: "/getApp", version: "1"}, functions.getApp);


// Start listening
server.listen(config.port_number ,"localhost", function(){
    console.log('%s listening at %s ', server.name , server.url);
});