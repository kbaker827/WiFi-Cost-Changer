'use strict';

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const schedule = require('node-schedule');

const execAsync = promisify(exec);

// Constants for error codes
const ErrorCodes = {
  GENERAL: 'stderr',
  NO_SSID: 'ssiderr',
  PLATFORM: 'platformerr',
  CONFIG: 'configerr'
};

// Cost states
const CostState = {
  UNRESTRICTED: 'Unrestricted',
  FIXED: 'Fixed'
};

// Load configuration
let config;
try {
  config = require('./config.json');
} catch (err) {
  console.error('Failed to load config.json, using defaults');
  config = {
    schedule: { unrestrictedStartHour: 0, unrestrictedEndHour: 8 },
    logging: { maxLogSizeBytes: 1048576, maxLogFiles: 5 },
    notifications: { enabled: true, sound: false },
    sleepDetection: { pollIntervalMs: 2000, wakeThresholdMs: 10000, wakeDelayMs: 12000 }
  };
}

// Platform check
const isWindows = process.platform === 'win32';

// Lazy-load notifier only on Windows
let notifier = null;
const getNotifier = () => {
  if (!notifier && isWindows) {
    const WindowsToaster = require('node-notifier').WindowsToaster;
    notifier = new WindowsToaster();
  }
  return notifier;
};

const icon = path.join(__dirname, 'assets', 'icon.png');
const logFile = path.join(__dirname, 'log.txt');

// Scheduled jobs storage (for cleanup)
let scheduledJobs = [];

/**
 * Escapes special characters in SSID for safe shell command execution
 * @param {string} ssid - The SSID to escape
 * @returns {string} - Escaped SSID safe for command line
 */
const escapeSSID = (ssid) => {
  if (!ssid || typeof ssid !== 'string') {
    return '';
  }
  // Escape characters that could be dangerous in cmd.exe
  // Replace double quotes with escaped quotes, and handle other special chars
  return ssid
    .replace(/"/g, '""')
    .replace(/[&|<>^%]/g, '^$&');
};

/**
 * Rotates log files when they exceed maxLogSizeBytes
 */
const rotateLogsIfNeeded = async () => {
  try {
    if (!fs.existsSync(logFile)) {
      return;
    }

    const stats = fs.statSync(logFile);
    if (stats.size < config.logging.maxLogSizeBytes) {
      return;
    }

    // Rotate existing log files
    for (let i = config.logging.maxLogFiles - 1; i >= 1; i--) {
      const oldFile = `${logFile}.${i}`;
      const newFile = `${logFile}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        if (i === config.logging.maxLogFiles - 1) {
          fs.unlinkSync(oldFile);
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current log to .1
    fs.renameSync(logFile, `${logFile}.1`);
  } catch (err) {
    console.error('Log rotation failed:', err.message);
  }
};

/**
 * Logs errors to file with timestamp
 * @param {Error|string} err - The error to log
 * @param {string} code - Error code for notification type
 */
const errLogger = async (err, code = ErrorCodes.GENERAL) => {
  const d = new Date();
  const timestamp = d.toISOString();
  const errorMessage = err instanceof Error ? err.message : String(err);
  const logEntry = `[${timestamp}] [${code}] ${errorMessage}\n`;

  try {
    await rotateLogsIfNeeded();
    fs.appendFileSync(logFile, logEntry);
  } catch (writeErr) {
    console.error('Failed to write to log:', writeErr.message);
  }

  notify('', code);
};

/**
 * Shows Windows notification
 * @param {string} state - The current cost state
 * @param {string|number} err - Error code or 0 for success
 */
const notify = (state, err = 0) => {
  if (!config.notifications.enabled) {
    return;
  }

  if (!isWindows) {
    console.log(err === 0 ? `WiFi Cost Changed: ${state}` : `Error: ${err}`);
    return;
  }

  const toaster = getNotifier();
  if (!toaster) {
    return;
  }

  let values;
  switch (err) {
    case 0:
      values = { t: 'WiFi Cost Changed', m: `Connection changed to ${state} state` };
      break;
    case ErrorCodes.GENERAL:
      values = { t: 'Oops :(', m: 'Error occurred, check log.txt' };
      break;
    case ErrorCodes.NO_SSID:
      values = { t: 'No SSID', m: 'Something is wrong. Are you connected to your WiFi?' };
      break;
    case ErrorCodes.PLATFORM:
      values = { t: 'Platform Error', m: 'This application only works on Windows' };
      break;
    case ErrorCodes.CONFIG:
      values = { t: 'Config Error', m: 'Failed to load configuration' };
      break;
    default:
      values = { t: 'Error', m: 'An unknown error occurred' };
  }

  const iconPath = fs.existsSync(icon) ? icon : undefined;

  toaster.notify({
    title: values.t,
    message: values.m,
    sound: config.notifications.sound,
    wait: false,
    icon: iconPath
  });
};

/**
 * Gets the current WiFi SSID
 * @returns {Promise<string|null>} - The SSID or null if not found
 */
const getSSID = async () => {
  if (!isWindows) {
    await errLogger('Cannot get SSID on non-Windows platform', ErrorCodes.PLATFORM);
    return null;
  }

  try {
    const { stdout } = await execAsync('netsh wlan show interfaces');

    // Use regex for more robust parsing
    const ssidMatch = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);

    if (!ssidMatch || !ssidMatch[1]) {
      await errLogger('No SSID found in netsh output', ErrorCodes.NO_SSID);
      return null;
    }

    const ssid = ssidMatch[1].trim();

    if (!ssid) {
      await errLogger('SSID is empty', ErrorCodes.NO_SSID);
      return null;
    }

    return ssid;
  } catch (err) {
    await errLogger(err, ErrorCodes.NO_SSID);
    return null;
  }
};

/**
 * Sets the WiFi cost to a specific state
 * @param {string} costState - The cost state (Unrestricted or Fixed)
 * @returns {Promise<boolean>} - True if successful
 */
const setWiFiCost = async (costState) => {
  if (!isWindows) {
    await errLogger('Cannot set WiFi cost on non-Windows platform', ErrorCodes.PLATFORM);
    return false;
  }

  // Always refresh SSID before changing state
  const ssid = await getSSID();

  if (!ssid) {
    return false;
  }

  const escapedSSID = escapeSSID(ssid);

  if (!escapedSSID) {
    await errLogger('Failed to escape SSID', ErrorCodes.GENERAL);
    return false;
  }

  try {
    const command = `netsh wlan set profileparameter name="${escapedSSID}" cost=${costState}`;
    await execAsync(command);
    notify(costState.toLowerCase());
    return true;
  } catch (err) {
    await errLogger(err);
    return false;
  }
};

/**
 * Sets WiFi to unrestricted mode
 * @returns {Promise<boolean>}
 */
const toUnrestricted = async () => {
  return setWiFiCost(CostState.UNRESTRICTED);
};

/**
 * Sets WiFi to fixed (metered) mode
 * @returns {Promise<boolean>}
 */
const toFixed = async () => {
  return setWiFiCost(CostState.FIXED);
};

/**
 * Cancels all scheduled jobs
 */
const cancelScheduledJobs = () => {
  scheduledJobs.forEach(job => {
    if (job && typeof job.cancel === 'function') {
      job.cancel();
    }
  });
  scheduledJobs = [];
};

/**
 * Main startup function - sets initial state and schedules jobs
 */
const onStart = async () => {
  if (!isWindows) {
    console.error('This application only works on Windows.');
    await errLogger('Application started on non-Windows platform', ErrorCodes.PLATFORM);
    return;
  }

  // Cancel any existing scheduled jobs before creating new ones
  cancelScheduledJobs();

  const currentHour = new Date().getHours();
  const { unrestrictedStartHour, unrestrictedEndHour } = config.schedule;

  // Set initial state based on current time
  if (currentHour >= unrestrictedStartHour && currentHour < unrestrictedEndHour) {
    await toUnrestricted();
  } else {
    await toFixed();
  }

  // Schedule daily state changes
  const unrestrictedJob = schedule.scheduleJob(
    `0 ${unrestrictedStartHour} * * *`,
    toUnrestricted
  );

  const fixedJob = schedule.scheduleJob(
    `0 ${unrestrictedEndHour} * * *`,
    toFixed
  );

  scheduledJobs.push(unrestrictedJob, fixedJob);

  console.log(`WiFi Cost Changer started. Schedule: Unrestricted ${unrestrictedStartHour}:00-${unrestrictedEndHour}:00`);
};

/**
 * Sleep/wake detection using time gap monitoring
 */
const setupSleepDetection = () => {
  let lastTime = Date.now();
  const { pollIntervalMs, wakeThresholdMs, wakeDelayMs } = config.sleepDetection;

  setInterval(() => {
    const currentTime = Date.now();
    const timeDelta = currentTime - lastTime;

    // If time jumped more than threshold, system likely woke from sleep
    if (timeDelta > pollIntervalMs + wakeThresholdMs) {
      console.log('System wake detected, re-checking WiFi state...');

      // Delay slightly to allow network to reconnect
      setTimeout(() => {
        onStart();
      }, wakeDelayMs);
    }

    lastTime = currentTime;
  }, pollIntervalMs);
};

/**
 * Graceful shutdown handler
 */
const shutdown = () => {
  console.log('Shutting down WiFi Cost Changer...');
  cancelScheduledJobs();
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the application
onStart();
setupSleepDetection();

// Export for testing
module.exports = {
  escapeSSID,
  getSSID,
  setWiFiCost,
  toUnrestricted,
  toFixed,
  onStart,
  ErrorCodes,
  CostState
};
