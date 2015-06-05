MLAB Compiler Service
----------------------------------------------------------------

## Install and start instructions (short version by Snapper):

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


Run in console:
- cd into directory
- node app.js
Serve as daemon:
- cd into directory
- pm2 start app.js
- pm2 stop app.js
- pm2 restart app.js

Install instructions for Compiler service with Android compiling on Xubuntu 14.04:
-----------------------------------------------------------------------------------------

### Div tools
  sudo apt-get install git  

Optional:  
   sudo apt-get install emacs    
   sudo apt-get install openssh-server    
   Install vmware tools    
      apt-get install gcc    
      apt-get install make    
      install the tools ...   
 
### Node js
sudo apt-get install nodejs  
sudo apt-get install npm  
sudo apt-get install nodejs-legacy ( node is named nodejs in newer ubuntu versions)  

### Oracle java
sudo apt-add-repository ppa:webupd8team/java  
sudo apt-get update  
sudo apt-get install oracle-java8-installer  

### Android SDK
Download from: http://dl.google.com/android/android-sdk_r24.2-linux.tgz  
Unpack to somewhere (e.g. /src/local/android-sdk)  
Add to path  
Run "android sdk" to install packages  
Some Android SDK tools (used by Cordova) are still only 32-bits. To make them work on Ubuntu 64bit:  
sudo apt-get install lib32stdc++6 lib32z1  

### Cordova
Install cordova globaly  with:  
sudo npm install -g cordova  
Test and read more on: https://cordova.apache.org/docs/en/3.0.0/guide_cli_index.md.html  

### rsync, ftp ???
ssh-keys, app-builder user login?



### Setup Compiler service
Git clone https://github.com/Sinettlab/mlab_compiler.git  
Edit config/config.json  


### Run the Compiler service
* in console:  
   - cd into directory  
   - node app.js  

