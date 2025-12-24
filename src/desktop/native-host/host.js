#!/usr/bin/env node

// Native Messaging Host for GenPwd Pro
// Communicates with browser extension via stdio

const fs = require('fs');
const path = require('path');

// Logging for debug (since stdout is used for communication)
const logFile = path.join(process.env.USERPROFILE, '.gemini', 'genpwd-native.log');
function log(msg) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

log('Native host started');

process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        // Determine message length (first 4 bytes)
        // Detailed native messaging protocol handling needed here
        // For now, basic echo or logging
        log('Received data chunk of size ' + chunk.length);
    }
});

process.stdin.on('end', () => {
    log('Stdin closed, exiting');
    process.exit(0);
});

// Send message to extension
function sendMessage(msg) {
    const buffer = Buffer.from(JSON.stringify(msg));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);

    process.stdout.write(header);
    process.stdout.write(buffer);
}

// Keep aalive
setInterval(() => {
    // Heartbeat or check if parent app is running
}, 10000);
