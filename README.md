# smartbulbs-smartthings
Provides a smartapp, device handler and node.js server to manage various lan connected devices
## V3
Third release.    
Provides a smartapp, device handler and node.js server to manage yeelight, mipow bulbs, Milight 2.4ghz bulbs (using a Ibox to connect to wifi), Somfy blinds connected to RFXCOM, and a first try and having findmyiphone




### Installation
**The yeelight bulbs must be set in developer mode (using settings in the yeelight supplied app )**
##### Create Directory /var/opt/node **(if it doesn't exist)**
**sudo mkdir /var/opt/node**
##### Create user and group to run the process

**sudo addgroup --system smartbulbs**

**sudo adduser --system smartbulbs --ingroup smartbulbs**

**sudo usermod -a -G dialout smartbulbs**

**getent group smartbulbs** *Check group created*

**id smartbulbs** *Check user created in the smartbulbs group*

##### Download files from github
**cd /var/opt/node**
**sudo git clone https://github.com/davidcreager/smartthings-smartbulbs.git**
##### Move files to correct directories
/var/opt/node/smartthings-smartbulbs
**sudo chown smartbulbs:smartbulbs /home/smartbulbs/**

**sudo cp /var/opt/node/smartthings-smartbulbs/smartbulbserver.service /etc/systemd/system/**

**sudo cp /var/opt/node/smartthings-smartbulbs/properties.json /home/smartbulbs/**

**sudo cp /var/opt/node/smartthings-smartbulbs/characteristics.json /home/smartbulbs/**

**sudo chown smartbulbs:smartbulbs /home/smartbulbs/properties.json**

**sudo chown smartbulbs:smartbulbs /home/smartbulbs/characteristics.json**

##### Use systemctl to have server start after startup
**sudo systemctl daemon-reload**
****sudo systemctl enable smartbulbserver**
##### Start server and check status
**sudo systemctl start smartbulbserver**
**sudo systemctl status smartbulbserver**

## Todo
Polling vs subscribe behavior
Sort out Settings that define how a bulb starts up
Investigate Color dimming and scaling (may not be a problem)




