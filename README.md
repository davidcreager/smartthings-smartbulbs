V0.0.1
First release.    
Provides a smartapp, device handler and node.js server to manage yeelight bulbs

Installation
create directory /var/opt/node/yeelight-smartthings  (You may need to create /var/opt/node)
sudo mkdir /var/opt/node/yeelight-smartthings
cd /var/opt/node/yeelight-smartthings
sudo git clone https://github.com/davidcreager/yeelight-smartthings.git
sudo cp /var/opt/node/yeelight-smartthings/yeelight-smartthings.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable yeelight-smartthings
copy the files into /var/opt/node/yeelight-smartthings (server.js,yee.js,config.json)
copy yeelight-smartthings.service into /etc/systemd/systemd/system

sudo systemctl daemon-reload
sudo systemctl --user enable yeelights
sudo systemctl start yeelight-smartthings
sudo systemctl enable yeelight-smartthings (this makes server run on startup)
journalctl -u yeelight-smartthings
Main process exited, code=exited, status=216/GROUP
Main process exited, code=exited, status=203/EXEC
Exec format error
Main process exited, code=exited, status=127/n/a

vim :se ff=unix




sudo adduser --system yeelights
sudo addgroup yeelightsmartthingserver
getent group yeelightsmartthingserver
sudo usermod -G yeelightsmartthingserver yeelights



Todo
Server - 
Devicehandler - color default handling word processing
Devicehandler - manage config
server - manage defaults
server - handle defaults
server - name and icon
server - cli ip and port and run as background
All - either poll or subscribe, potentially needs to change deviceIDs to ip adresses
