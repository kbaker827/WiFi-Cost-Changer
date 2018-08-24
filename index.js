const cmd = require('node-cmd')
const schedule = require('node-schedule')

const toUnrestricted = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Unrestricted`,
  (err, data) => {
    if(err) throw err
    console.log('WiFi cost changed to UNRESTRICTED')
  })
}

const toFixed = () => {
  cmd.get(`netsh wlan set profileparameter name="4G Router" cost=Fixed`,
  (err, data) => {
    if(err) throw err
    console.log('WiFi cost changed to FIXED')
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

onStart()
schedule.scheduleJob('0 0 * * *', toUnrestricted)
schedule.scheduleJob('0 8 * * *', toFixed)