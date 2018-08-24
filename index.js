const cmd = require('node-cmd')
const schedule = require('node-schedule')
const WindowsToaster = require('node-notifier').WindowsToaster

const notifier = new WindowsToaster()

const toUnrestricted = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Unrestricted`,
  (err, data) => {
    if(err) throw err
    console.log('WiFi cost changed to UNRESTRICTED')
    notify(false)
  })
}

const toFixed = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Fixed`,
  (err, data) => {
    if(err) throw err
    console.log('WiFi cost changed to FIXED')
    notify(true)
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

const notify = (params) => {
  let state = params ? 'metered' : 'unrestricted'
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