'use strict';

// Mock dependencies before requiring the module
jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(() => ({ cancel: jest.fn() }))
}));

jest.mock('node-notifier', () => ({
  WindowsToaster: jest.fn(() => ({
    notify: jest.fn()
  }))
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock config
jest.mock('./config.json', () => ({
  schedule: { unrestrictedStartHour: 0, unrestrictedEndHour: 8 },
  logging: { maxLogSizeBytes: 1048576, maxLogFiles: 5 },
  notifications: { enabled: true, sound: false },
  sleepDetection: { pollIntervalMs: 2000, wakeThresholdMs: 10000, wakeDelayMs: 12000 }
}), { virtual: true });

const { escapeSSID, ErrorCodes, CostState } = require('./index');

describe('WiFi Cost Changer', () => {
  describe('escapeSSID', () => {
    it('should return empty string for null input', () => {
      expect(escapeSSID(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(escapeSSID(undefined)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(escapeSSID(123)).toBe('');
      expect(escapeSSID({})).toBe('');
      expect(escapeSSID([])).toBe('');
    });

    it('should return the same string for safe SSIDs', () => {
      expect(escapeSSID('MyHomeWiFi')).toBe('MyHomeWiFi');
      expect(escapeSSID('WiFi_Network_5G')).toBe('WiFi_Network_5G');
      expect(escapeSSID('Guest Network')).toBe('Guest Network');
    });

    it('should escape double quotes', () => {
      expect(escapeSSID('My"WiFi')).toBe('My""WiFi');
      expect(escapeSSID('"Network"')).toBe('""Network""');
    });

    it('should escape ampersand', () => {
      expect(escapeSSID('Tom & Jerry WiFi')).toBe('Tom ^& Jerry WiFi');
    });

    it('should escape pipe character', () => {
      expect(escapeSSID('WiFi|Network')).toBe('WiFi^|Network');
    });

    it('should escape angle brackets', () => {
      expect(escapeSSID('WiFi<Network>')).toBe('WiFi^<Network^>');
    });

    it('should escape caret', () => {
      expect(escapeSSID('WiFi^Network')).toBe('WiFi^^Network');
    });

    it('should escape percent sign', () => {
      expect(escapeSSID('WiFi%50')).toBe('WiFi^%50');
    });

    it('should handle multiple special characters', () => {
      expect(escapeSSID('Test"&|<>^%')).toBe('Test""^&^|^<^>^^%');
    });

    it('should handle command injection attempts', () => {
      const maliciousSSID = 'test"; rm -rf /; "';
      const escaped = escapeSSID(maliciousSSID);
      expect(escaped).not.toContain(';');
      expect(escaped).toBe('test""; rm -rf /; ""');
    });
  });

  describe('ErrorCodes', () => {
    it('should have GENERAL error code', () => {
      expect(ErrorCodes.GENERAL).toBe('stderr');
    });

    it('should have NO_SSID error code', () => {
      expect(ErrorCodes.NO_SSID).toBe('ssiderr');
    });

    it('should have PLATFORM error code', () => {
      expect(ErrorCodes.PLATFORM).toBe('platformerr');
    });

    it('should have CONFIG error code', () => {
      expect(ErrorCodes.CONFIG).toBe('configerr');
    });
  });

  describe('CostState', () => {
    it('should have UNRESTRICTED state', () => {
      expect(CostState.UNRESTRICTED).toBe('Unrestricted');
    });

    it('should have FIXED state', () => {
      expect(CostState.FIXED).toBe('Fixed');
    });
  });
});
