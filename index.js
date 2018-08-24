const cmd = require('node-cmd')
const schedule = require('node-schedule')
const WindowsToaster = require('node-notifier').WindowsToaster
const notifier = new WindowsToaster()

const toUnrestricted = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Unrestricted`,
  (err, data) => {
    if(err) throw err
    notify('unrestricted')
  })
}

const toFixed = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Fixed`,
  (err, data) => {
    if(err) throw err
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

const logger = (state) => {
  let d = new Date()
  console.log(`${d.getMonth()}${d.getDate()}/${d.getHours()}:${d.getMinutes()} WiFi cost changed to ${state}`)  
}

const notify = (state) => {
  logger(state)
  notifier.notify({
    title: 'WiFi Cost Changed',
    message: `Connection changed to ${state} state`,
    sound: false,
    wait: false,
    icon: './icon.png',
    //appID: 'com.wtfisthis.wificostchanger' //uncomment before make the exe
  })
}

onStart()
schedule.scheduleJob('0 0 * * *', toUnrestricted)
schedule.scheduleJob('0 8 * * *', toFixed)

// Fire the a quick time check when windows wakeup after sleep/hibernation
let lastTime = new Date().getTime()
const timeOut = 2000
setInterval(()=>{
  let currentTime = new Date().getTime()
  if (currentTime > lastTime + timeOut + 10000) {
    onStart()
  }
  lastTime = currentTime
}, timeOut)
