MLAB Compiler Service
----------------------------------------------------------------
Copyright (c) 2013-2016, Norwegian Defence Research Establishment (FFI) - All Rights Reserved
Proprietary and confidential
For the full copyright and license information, please view the LICENSE_MLAB file that was distributed with this source code.


Install instructions for Compiler service with Android compiling on Xubuntu 14.04:
-----------------------------------------------------------------------------------------

### Div tools
```
  sudo apt-get install git
```

#### Optional tools:  
```
   sudo apt-get install emacs    
   sudo apt-get install openssh-server
```       
#### Vmware tools (optional)
```
    sudo apt-get install gcc    
    sudo apt-get install make 
```
Then install the tools ...   
 
### Node js

Ubuntu 14 comes with an old node version, so install from ppa (https://github.com/nodesource/distributions#debinstall)

```
curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
sudo apt-get install nodejs
```

FIX! The following may not be necessary ..
```
sudo apt-get install npm  
sudo apt-get install nodejs-legacy   
```
`nodejs-legacy` is necessary since node is now named nodejs in latest ubuntu versions

### Oracle java
```
sudo apt-add-repository ppa:webupd8team/java  
sudo apt-get update  
sudo apt-get install oracle-java8-installer  
```

### Android SDK
Download from: http://dl.google.com/android/android-sdk_r24.2-linux.tgz  
Unpack to somewhere (e.g. /opt/android-sdk). Destination should be put in config.json of the CS.  


Run `/opt/android-sdk/tools/android`to open SDK Manager and install necessary packages

http://cordova.apache.org/docs/en/5.0.0/guide_platforms_android_index.md.html

Some Android SDK tools (used by Cordova) are still only 32-bits. To make them work on Ubuntu 64bit:  
```
sudo apt-get install lib32stdc++6 lib32z1  
```

To make sure cordova will find the sdk, the safest is to add the `/opt/android-sdk/tools` and `/opt/android-sdk/platform-tools` to `/etc/environment`  

### Cordova
Install cordova globaly  with:  
```
sudo npm install -g cordova
```
Cordova is then installed into: /usr/local/lib/node_modules/cordova

Test and read more on: https://cordova.apache.org/docs/en/5.1.1/guide_cli_index.md.html#The%20Command-Line%20Interface

When cordova is installed globally (-g). A tmp folder is created in the current users home folder, but this is owned by root. 
Remove or change permissions to this folder
 ``` 
 sudo rmdir ~/tmp/
 ```

### Create mlab_cs user and group
Create user and group `mlab_cs`. Set password and remember. When set in the CS config, all Cordova commands should be executed as this user.

```
groupadd mlab_cs
useradd -m -g mlab_cs mlab_cs
passwd mlab_cs
```

To add other users to the mlab_cs group: `usermod -a -G mlab_cs username`. It is necessary to logout and back in if the user being added is logged in.


### Preparing filesystem
We will let the compiler service do most of its magic in the /var/local/mlab_cs folder
The compiler service will look for www-folders, and more, of the apps to be compiled in: `/var/local/mlab_cs/inbox`
The compiler service and cordova will use the folder `/var/local/mlab_cs/working` for compiling apps

```bash
mkdir /var/local/mlab_cs
mkdir /var/local/mlab_cs/inbox
mkdir /var/local/mlab_cs/working
chown -R root:mlab_cs /var/local/mlab_cs 
chmod -R 770 /var/local/mlab_cs
```

The `inbox` is the dir used for the rsync share. The MLAB editor will put apps to be compiled in this dir.
The `working` directory is the working directory for the compiler service. Cordova commands are run in this directory. 

### rsync
We will install rsync, running  as a daemon on default port 873, to be able to move files between the app-builder and the compiler services

Configuration is based on https://help.ubuntu.com/community/rsync

#### Configuration of the rsync Daemon

Edit the file /etc/default/rsync to start rsync as daemon using xinetd. The entry listed below, should be changed from false to inetd.

```
RSYNC_ENABLE=inetd
```

Install xinetd. It is not installed by default.
```
sudo apt-get -y install xinetd
```

Create the file /etc/xinetd.d/rsync to launch rsync via xinetd. It should contain the following lines of text.

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
Create the file `/etc/rsyncd.conf` configuration for rsync in daemon mode. This would make the share `cs_inbox` read and writable for user `mlab`.

```
max connections = 6
log file = /var/log/rsync.log
timeout = 300

[cs_inbox]
comment = Compiler server inbox, where to put the app to be compiled
path = /var/local/mlab_cs/inbox
read only = no
list = yes
uid = mlab_cs
gid = mlab_cs
auth users = mlab
secrets file = /etc/rsyncd.secrets
```

Create /etc/rsyncd.secrets for mlab user's password. Replace `password` with a suitable password. 
```
sudo vim /etc/rsyncd.secrets 
mlab:password
```

This step sets the file permissions for rsyncd.secrets.
```
$ sudo chmod 600 /etc/rsyncd.secrets
```

Start/Restart xinetd
```
sudo /etc/init.d/xinetd restart
```

Testing rsync

Run the following command to check if everything is ok. You will be asked for the password and the output would be the content of the share (probably empty).
```
rsync mlab@localhost::cs_inbox
```


### Download and setup Compiler service
Logg in as mlab_cs and

```bash
cd ~
mkdir MLAB
cd MLAB
git clone https://github.com/Sinettlab/mlab_compiler.git
```

Install dependencies:
```
cd mlab_compiler
npm install
```
This will install node.js dependencies in a `node_modules` folder within the `mlab_compiler` folder

Edit config/config.json

* `cordova_user` is the user to perform the cordova commands. The user running the node.js server would need privileges to run these commands as a different user if they are not the same. Use `mlab_cs` if no good reason not to.
* `listen_on_ip` set the ip CS should listen on. Set to `0.0.0.0` is CS should listen on all ports
* `inbox_path` is the path of the rsync directory. CS will fetch the files from this directory and compile them in the `cordova_apps_path` directory
* `key` is the passphrase used in calls to the CS server


### Run the Compiler service
* in console:  
   - cd into directory  
   - `node app.js` or `npm start` 

* Serve as daemon:
    - cd into directory
    - pm2 start app.js
    - pm2 stop app.js
    - pm2 restart app.js

    
### Testing and debugging

####jMeter 
jMeter may be used to script calls to the server. A jMeter script-file is in the sinettlab/bard repository

#### Callback server
A very simple callback server (node.js) is in the sinettlab/bard repository


#### node-inspector and chrome
If node.js is not run from an IDE supporting node.js debugging. 

```
npm install -g node-inspector
```

Run app with:
`node-debug app.js`
Should be combined with chrome plugin for node-inspector 




# Install and start instructions (short version by Snapper):

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