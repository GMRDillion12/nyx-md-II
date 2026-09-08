/**
 * Restart Command - Restart bot (Owner Only)
 */

const { exec, spawn } = require('child_process');
const path = require('path');

module.exports = {
  command: ['reboot'],
  category: 'owner',
  description: 'Restart the bot',
  usage: '.reboot',
  ownerOnly: true,

  async execute(sock, m, args, config) {
    try {
      // Send notification before restart
      try {
        await sock.sendMessage(m.chat, {
          text: '🔁 *Restarting bot...*\n⏳ This may take a few seconds.',
          edit: m.key
        }, { quoted: m }).catch(() => 
          sock.sendMessage(m.chat, {
            text: '🔁 *Restarting bot...*\n⏳ This may take a few seconds.'
          }, { quoted: m })
        );
      } catch (err) {
        console.log('⚠️ Could not send restart message');
      }

      // Give message time to send
      await new Promise(resolve => setTimeout(resolve, 800));

      console.log('\n╭━━━━━━━━━━━━━━━━━━━━━━━━╮');
      console.log('┃  🔄 RESTART INITIATED  ┃');
      console.log('╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n');

      // Gracefully close socket connection
      try {
        console.log('📡 Closing WhatsApp connection...');
        sock.end?.();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.log('⚠️ Socket closure warning:', err.message);
      }

      // Try PM2 restart first
      try {
        console.log('🚀 Attempting PM2 restart...');
        exec('pm2 restart all', (error) => {
          if (error) {
            console.log('⚠️ PM2 not running, fallback initiated');
            fallbackRestart();
          } else {
            console.log('✅ PM2 restart initiated');
          }
        });
        return;
      } catch (e) {
        console.log('⚠️ PM2 error, using fallback');
        fallbackRestart();
      }

      function fallbackRestart() {
        // For terminal execution: graceful process exit with 0 (success)
        // The terminal/panel/nodemon will auto-restart
        setTimeout(() => {
          console.log('⏹️  Process shutting down gracefully...');
          console.log('🔄 Restarting process...\n');
          
          // Spawn new process before exit to maintain continuity
          try {
            const child = spawn('node', ['index.js'], {
              cwd: process.cwd(),
              stdio: 'inherit',
              detached: false
            });

            child.on('error', (err) => {
              console.error('❌ Spawn error:', err.message);
              process.exit(1);
            });

            // Give it time to start, then exit parent
            setTimeout(() => process.exit(0), 300);
          } catch (err) {
            console.error('❌ Failed to spawn new process:', err);
            // Just exit and let terminal handle it
            process.exit(0);
          }
        }, 500);
      }

    } catch (error) {
      console.error('❌ Restart error:', error);
      try {
        await sock.sendMessage(m.chat, {
          text: `❌ *Restart failed!*\n\`\`\`${error.message}\`\`\``
        }, { quoted: m });
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
      process.exit(1);
    }
  }
};
