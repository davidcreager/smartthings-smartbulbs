<<<<<<< HEAD
# smartbulbs-smartthings
=======
#Use tag V1.0 V2.0 not quite ready

# yeelight-smartthings
>>>>>>> 5d5bca1804218bbdfc208a6396f7751c1e7706d8
Provides a smartapp, device handler and node.js server to manage yeelight bulbs
## V0.0.1
First release.    
Provides a smartapp, device handler and node.js server to manage yeelight bulbs


### Installation
**The yeelight bulbs must be set in developer mode (using settings in the yeelight supplied app )**
##### Create Directory /var/opt/node **(if it doesn't exist)**
**sudo mkdir /var/opt/node**
##### Create user and group to run the process
**sudo addgroup --system smartbulbs**
**sudo adduser --system smartbulbs --ingroup smartbulbs**
**getent group smartbulbs** *Check group created*
**id smartbulbs** *Check user created in the yeelights group*
##### Download files from github
**cd /var/opt/node**
**sudo git clone https://github.com/davidcreager/smartthings-smartbulbs.git**
##### Move files to correct directories
/var/opt/node/smartthings-smartbulbs
**sudo chown smartbulbs:smartbulbs /home/smartbulbs/**
**sudo cp /var/opt/node/smartthings-smartbulbs/smartbulbserver-smartthings.service /etc/systemd/system/**
**sudo cp /var/opt/node/smartthings-smartbulbs/properties.json /home/yeelights/**
**sudo chown smartbulbs:smartbulbs /home/smartbulbs/properties.json**
##### Use systemctl to have server start after startup
**sudo systemctl daemon-reload**
****sudo systemctl enable smartbulbserver-smartthings**
##### Start server and check status
**sudo systemctl start smartbulbserver-smartthings**
**sudo systemctl status yeelight-smartthings**

## Todo
Polling vs subscribe behavior
Sort out Settings that define how a bulb starts up
Investigate Color dimming and scaling (may not be a problem)




