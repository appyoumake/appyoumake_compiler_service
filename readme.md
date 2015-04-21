# MLAB Compiler Service

Install and start instructions:

All platforms:
- Pull or copy this code into somewhere
- Install node.js
    - Ubuntu: apt-get install nodejs
    - Others: https://nodejs.org/download/
- Install PM2:
    npm install pm2 -g

- Prerequisites for compiling for iOS
    - Xcode installed
    - Code signing identity and provisioning profile set up (name of provisioning profile goes into config file)
- Prerequisistes for compiling for Android
    - Android SDK installed (path goes into config file)


Run in console:
- cd into directory
- node app.js
Serve as daemon:
- cd into directory
- pm2 start app.js
- pm2 stop app.js
- pm2 restart app.js