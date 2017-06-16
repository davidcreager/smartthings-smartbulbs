# yeelight-smartthings
Provides a smartapp, device handler and node.js server to manage yeelight bulbs
## V0.0.1
First release.    
Provides a smartapp, device handler and node.js server to manage yeelight bulbs


### Installation
**The yeelight bulbs must be set in developer mode (using settings in the yeelight supplied app )**
##### Create Directory /var/opt/node/yeelight-smartthings
**sudo mkdir /var/opt/node/yeelight-smartthings** *(You may also need to create /var/opt/node if it is not on your system)*
##### Create user and group to run the process
**sudo addgroup --system yeelights**

**sudo adduser --system yeelights --ingroup yeelights**

**getent group yeelights** *Check group created*

**id yeelights** *Check user created in the yeelights group*

##### Download files from github
**cd /var/opt/node**
**sudo git clone https://github.com/davidcreager/yeelight-smartthings.git**
##### Move files to correct directories
**sudo cp /var/opt/node/yeelight-smartthings/yeelight-smartthings.service /etc/systemd/system/**

**sudo cp /var/opt/node/yeelight-smartthings/config.json /home/yeelights/**

**sudo chown yeelights:yeelights /home/yeelights/**

**sudo chown yeelights:yeelights /home/yeelights/config.json**

##### Use systemctl to have server start after startup
**sudo systemctl daemon-reload**

**sudo systemctl enable yeelight-smartthings**

##### Start server and check status
**sudo systemctl start yeelight-smartthings**

**sudo systemctl status yeelight-smartthings**

## Todo
Polling vs subscribe behavior
Sort out Settings that define how a bulb starts up
Investigate Color dimming and scaling (may not be a problem)




