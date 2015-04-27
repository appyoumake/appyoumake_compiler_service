# MLAB Compiler Service

Install and start instructions:

All platforms:
- Install Cordova/Phonegap
- Clone or copy this code into somewhere useful
- Install node.js (probably already installed because Cordova uses it)
    - Ubuntu: apt-get install nodejs
    - Others: https://nodejs.org/download/
- Install PM2:
    npm install pm2 -g

- Prerequisites for compiling for iOS
    - Must be done on OSX
    - Xcode installed (tested on Xcode 6.3)
    - Code signing identity and provisioning profile set up (name of provisioning profile goes into config file)
- Prerequisistes for compiling for Android
    - Android SDK installed (path goes into config file)
- Prerequisites for compiling for Windows
    - Must be done on Windows
    - Windows phone SDK (http://dev.windows.com/en-us/develop/download-phone-sdk)


Run in console:
- cd into directory
- node app.js
Serve as daemon:
- cd into directory
- pm2 start app.js
- pm2 stop app.js
- pm2 restart app.js