const path = require('path')
const fs = require('fs')
const cmd = require('node-cmd')
const schedule = require('node-schedule')
const WindowsToaster = require('node-notifier').WindowsToaster
const notifier = new WindowsToaster()

const icon = path.join(__dirname, 'assets', 'icon.png')

const toUnrestricted = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Unrestricted`,
  (err) => {
    if(err) return errLogger(err)
    notify('unrestricted')
  })
}

const toFixed = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Fixed`,
  (err) => {
    if(err) return errLogger(err)
    notify('fixed')
  })
}

const onStart = () => {
  let h = new Date().getHours()
  if ( h < 8 ) {
    toUnrestricted()
  } else {
    toFixed()
  }
}

const errLogger = (err) => {
  let d = new Date()
  let error = `${d.getMonth()}:${d.getDate()}/${d.getHours()}:${d.getMinutes()}:${d.getSeconds()} \n ${err} \n \n`
  fs.appendFile(path.join(__dirname, 'log.txt'), error, (err) => {
    //wrote a function to remove console.log, writing a console.log to handle error of that function lol
    if(err) throw err
    notify('', true)    
  })  
}

const notify = (state, err = false) => {
  let values = err ? {t: 'Oops :(', m: `Error occured, check log.txt`} : {t: 'WiFi Cost Changed', m: `Connection changed to ${state} state`}
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
schedule.scheduleJob('0 0 * * *', toUnrestricted)
schedule.scheduleJob('0 8 * * *', toFixed)

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
