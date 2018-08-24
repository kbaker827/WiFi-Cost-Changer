# WiFi 'Cost' Changer

Changes WiFi **Cost** state (metered or not) according to current time
This one is useful for people who use interenet with a fixed quota to save their day time data by doing windows update stuff in night time

### Current time period to Change WiFi state
from 0000h to 0800h cost changes to unrestricted mode

### How to use
Clone this, open cmd, type node index

> TIP: Use [PM2](https://github.com/Unitech/pm2) to run the task in background (no need to keep the cmd open)

## TODO
1. Add a GUI to change variables
2. Transform into background app which runs in one click
3. Ability to change the Ethernet's cost state
4. Change the name into 'Wifi & Ethernet' or something like that if I complete the above task 😉👌