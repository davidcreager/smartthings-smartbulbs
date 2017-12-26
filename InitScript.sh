#!/bin/sh
mkdir -v -p /var/opt/node
useradd -m -G dialout smartserver || echo "User already exists."
chown smartserver:smartserver /home/smartserver/
cd  /var/opt/node
git clone https://github.com/davidcreager/smartthings-smartbulbs.git
cp /var/opt/node/smartthings-smartbulbs/smartbulbserver.service /etc/systemd/system/
cp /var/opt/node/smartthings-smartbulbs/properties.json /home/smartserver/
cp /var/opt/node/smartthings-smartbulbs/characteristics.json /home/smartserver/
chown smartserver:smartserver /home/smartserver/properties.json
chown smartserver:smartserver /home/smartserver/characteristics.json
systemctl enable smartbulbserver
systemctl daemon-reload
systemctl start smartbulbserver
systemctl status smartbulbserver
