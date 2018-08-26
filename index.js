const path = require('path')
const fs = require('fs')
const cmd = require('node-cmd')
const schedule = require('node-schedule')
const WindowsToaster = require('node-notifier').WindowsToaster
const notifier = new WindowsToaster()

const icon = path.join(__dirname, 'assets', 'icon.png')

let ssid

const toUnrestricted = () => {
  cmd.get(`netsh wlan set profileparameter name="${ssid}" cost=Unrestricted`,
  (err) => {
    if(err) return errLogger(err)
    notify('unrestricted')
  })
}

const toFixed = () => {
  cmd.get(`netsh wlan set profileparameter name="${ssid}" cost=Fixed`,
  (err) => {
    if(err) return errLogger(err)
    notify('fixed')
  })
}

const onStart = () => {
  cmd.get(`netsh wlan show interfaces | findstr /R /C:\" SSID\"`,  //get SSID
  (err, data) => {
    if(err) return errLogger(err, 'ssiderr')
    ssid = data.split(':')[1].trim()

    let h = new Date().getHours()
    if ( h < 8 ) {
      toUnrestricted()
    } else {
      toFixed()
    }

    schedule.scheduleJob('0 0 * * *', toUnrestricted) // Changes to unrestricted at 0000h
    schedule.scheduleJob('0 8 * * *', toFixed)        // Changes to fixed at 0800h
  })
  
}

const errLogger = (err, code='stderr') => {
  let d = new Date()
  let error = `${d.getMonth()}:${d.getDate()}/${d.getHours()}:${d.getMinutes()}:${d.getSeconds()} \n ${err} \n \n`
  fs.appendFile(path.join(__dirname, 'log.txt'), error, () => {
    notify('', code)
  })  
}

const notify = (state, err = 0) => {
  let values
  switch(err) {
    case 0:
      values = {t: 'WiFi Cost Changed', m: `Connection changed to ${state} state`}
      break
    case 'stderr':
      values = {t: 'Oops :(', m: `Error occured, check log.txt`}
      break
    case 'ssiderr':
      values = {t: 'No SSID', m: `Something is wrong. Are you connected to your wifi?.`}
      break
  }
  notifier.notify({
    title: values.t,
    message: values.m,
    sound: false,
    wait: false,
    icon: icon,
    //appID: 'com.wtfisthis.wificostchanger' //uncomment before make the exe
  })
}

onStart()

// Fire a quick time check when windows wakeup after sleep/hibernation
let lastTime = new Date().getTime()
const timeOut = 2000
setInterval(()=>{
  let currentTime = new Date().getTime()
  if (currentTime > lastTime + timeOut + 10000) {
    onStart()
  }
  lastTime = currentTime
}, timeOut)
