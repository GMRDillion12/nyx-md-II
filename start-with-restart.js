#!/usr/bin/env node
/**
 * Auto-Restart Wrapper - Run this instead of "node index.js"
 * Usage: node start-with-restart.js
 * 
 * This script will automatically restart the bot when the .restart command is used
 * Maintains WhatsApp session across restarts
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BOT_SCRIPT = 'index.js';
const MAX_RESTARTS = 10; // Prevent infinite restart loops
const RESTART_DELAY = 1000; // 1 second delay between restarts

let restartCount = 0;
let lastRestartTime = 0;

console.log('╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮');
console.log('┃   NYX-MD AUTO-RESTART v1     ┃');
console.log('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n');

function startBot() {
  console.log(`\n🚀 Starting bot (Attempt ${restartCount + 1})...`);
  
  const botProcess = spawn('node', [BOT_SCRIPT], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  botProcess.on('exit', (code, signal) => {
    restartCount++;
    
    // If exit code is 0 (graceful exit), restart
    if (code === 0) {
      console.log('\n✅ Bot stopped gracefully (Code 0)');
      
      // Anti-spam: Check restart frequency
      const timeSinceLastRestart = Date.now() - lastRestartTime;
      if (timeSinceLastRestart < 2000) {
        console.log('⚠️  Restart requested too quickly, waiting...');
        setTimeout(() => {
          lastRestartTime = Date.now();
          startBot();
        }, RESTART_DELAY * 2);
      } else {
        lastRestartTime = Date.now();
        
        // Restart limit check
        if (restartCount > MAX_RESTARTS) {
          console.error('❌ Too many restarts! Stopping to prevent loop.');
          console.error('💡 Check for errors in your code.');
          process.exit(1);
        }
        
        startBot();
      }
    } 
    // If exit code is non-zero, it's an error
    else if (code !== null) {
      console.log(`\n❌ Bot crashed with code ${code}`);
      console.log('⚠️  This might be a configuration issue. Fix it and restart.');
      process.exit(1);
    }
    // If killed by signal, attempt restart
    else if (signal) {
      console.log(`\n⚠️  Bot terminated by signal: ${signal}`);
      if (restartCount <= MAX_RESTARTS) {
        setTimeout(startBot, RESTART_DELAY);
      }
    }
  });

  botProcess.on('error', (err) => {
    console.error('❌ Failed to start bot:', err.message);
    process.exit(1);
  });
}

// Start the bot
startBot();

// Handle terminal interrupt gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down bot wrapper...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Bot wrapper terminated...');
  process.exit(0);
});
