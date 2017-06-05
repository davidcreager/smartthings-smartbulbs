V0.0.1
First release.    
Provides a smartapp, device handler and node.js server to manage yeelight bulbs

Installation
create directory /var/opt/node/yeelight-smartthings  (You may need to create /var/opt/node)

sudo addgroup --system yeelights
sudo adduser --system yeelights --ingroup yeelights
getent group yeelights
id yeelights



sudo mkdir /var/opt/node/yeelight-smartthings
cd /var/opt/node/yeelight-smartthings

sudo git clone https://github.com/davidcreager/yeelight-smartthings.git

sudo cp /var/opt/node/yeelight-smartthings/yeelight-smartthings.service /etc/systemd/system/
sudo cp /var/opt/node/yeelight-smartthings/config.json /home/yeelights/
sudo chown yeelights:yeelights /home/yeelights/config.json

sudo systemctl daemon-reload
sudo systemctl enable yeelight-smartthings
sudo systemctl start yeelight-smartthings
sudo systemctl status yeelight-smartthings


sudo chown yeelights:yeelights /home/yeelights/

sudo chmod a+x server.js


Todo
Server - 
Devicehandler - color default handling word processing
Devicehandler - manage config
server - manage defaults
server - handle defaults
server - name and icon
server - cli ip and port and run as background
All - either poll or subscribe, potentially needs to change deviceIDs to ip adresses
