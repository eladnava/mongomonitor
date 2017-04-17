#!/usr/bin/env node
var path = require('path');
var log = require('npmlog');
var program = require('commander');
var monitor = require('./lib/monitor');
var logger = require('./util/logger');

// Define CLI arguments and options
program
    .version('1.0.0')
    .option('--test-email', 'send a test e-mail to verify SMTP config')
    .option('-c, --config <path>', 'provide a custom path to the mongomonitor config file')
    .parse(process.argv);

// Determine absolute path to config file
var configPath = path.resolve(program.config || 'config.js');

// Log config file path
log.info('mongomonitor', 'Initializing using the following config file: ' + configPath);

// Attempt to load config file
var config = require(configPath);

// Send test e-mail flag passed?
if (program.testEmail) {
    return logger.notifyError(new Error('This is a test e-mail alert for testing the SMTP config.'), config, 'Test E-mail Alert');
}

// Start monitoring
new monitor(config).startMonitoring();