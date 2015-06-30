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
```
  sudo apt-get install git
```

#### Optional toolsl:  
```
   sudo apt-get install emacs    
   sudo apt-get install openssh-server
```       
#### Vmware tools (optional)
```
      apt-get install gcc    
      apt-get install make 
```
      Then install the tools ...   
 
### Node js
```
sudo apt-get install nodejs  
sudo apt-get install npm  
sudo apt-get install nodejs-legacy   
```
nodejs-legacy is necessary since node is now named nodejs in latest ubuntu versions

### Oracle java
```
sudo apt-add-repository ppa:webupd8team/java  
sudo apt-get update  
sudo apt-get install oracle-java8-installer  
```

### Android SDK
Download from: http://dl.google.com/android/android-sdk_r24.2-linux.tgz  
Unpack to somewhere (e.g. /src/local/android-sdk)  
Add to path  
Run "android sdk" to install packages  
Some Android SDK tools (used by Cordova) are still only 32-bits. To make them work on Ubuntu 64bit:  
```
sudo apt-get install lib32stdc++6 lib32z1  
```

### Cordova
Install cordova globaly  with:  
```
sudo npm install -g cordova
```
Cordova is then installed into: /usr/local/lib/node_modules/cordova
Test and read more on: https://cordova.apache.org/docs/en/5.1.1/guide_cli_index.md.html#The%20Command-Line%20Interface

### Preparing filesystem (create users?
We will let the compiler service do its magic in the /var/local/mlab_cs folder
The compiler service will look for www-folders of the apps to be compiled in: /var/local/mlab_cs/inbox
The compiler service will use the folder /var/local/mlab_cs/working for compiling apps
Compiled apps are put in ... (or served directly from ...)
```bash
mkdir /var/local/mlab_cs
mkdir /var/local/mlab_cs/inbox
mkdir /var/local/mlab_cs/working
chmod 
```
The same directory should be served using rsync


### rsync
Based on https://help.ubuntu.com/community/rsync

#### Configuration of the rsync Daemon

1. Edit the file /etc/default/rsync to start rsync as daemon using xinetd. The entry listed below, should be changed from false to inetd.

```
RSYNC_ENABLE=inetd
```

2. Install xinetd because it's not installed by default.
```
sudo apt-get -y install xinetd
```

3. Create the file /etc/xinetd.d/rsync to launch rsync via xinetd. It should contain the following lines of text.

```
service rsync
{
    disable = no
    socket_type = stream
    wait = no
    user = root
    server = /usr/bin/rsync
    server_args = --daemon
    log_on_failure += USERID
    flags = IPv6
}
```
4. Create the file /etc/rsyncd.conf configuration for rsync in daemon mode. The file should contain the following. In the file, user should be replaced with the name of user on the remote machine being logged into.

```
max connections = 2
log file = /var/log/rsync.log
timeout = 300

[share]
comment = Public Share
path = /home/share
read only = no
list = yes
uid = nobody
gid = nogroup
auth users = user
secrets file = /etc/rsyncd.secrets
```

5. Create /etc/rsyncd.secrets for user's password. User should be the same as above, with password the one used to log into the remote machine as the indicated user.
```
sudo vim /etc/rsyncd.secrets 
user:password
```

6. This step sets the file permissions for rsyncd.secrets.
```
$ sudo chmod 600 /etc/rsyncd.secrets
```

7. Start/Restart xinetd
```
sudo /etc/init.d/xinetd restart
```


### Setup Compiler service
```bash

git clone https://github.com/Sinettlab/mlab_compiler.git
```

Edit config/config.json  


### Run the Compiler service
* in console:  
   - cd into directory  
   - node app.js  

* Serve as daemon:
    - cd into directory
    - pm2 start app.js
    - pm2 stop app.js
    - pm2 restart app.js