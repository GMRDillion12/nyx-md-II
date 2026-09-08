#!/usr/bin/env node
/**
 * 🔄 NYX-MD RESTART FEATURE - SETUP GUIDE
 * 
 * This file explains how the restart system works and how to use it properly.
 */

const guide = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│     NYX-MD RESTART SYSTEM - SETUP GUIDE   │
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

✨ FEATURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Graceful bot restart via WhatsApp command
✅ Maintains WhatsApp session across restarts
✅ Auto-restart on terminal exit (code 0)
✅ Supports PM2 process manager
✅ Prevents infinite restart loops
✅ Graceful socket connection cleanup


📋 INSTALLATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The restart system is already installed! Files created:
  ✓ plugins/owner/restart.js     - WhatsApp restart command
  ✓ start-with-restart.js        - Terminal auto-restart wrapper
  ✓ package.json                 - Updated with new scripts


🚀 HOW TO USE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

METHOD 1: Terminal with Auto-Restart (RECOMMENDED)
────────────────────────────────────────────────────
Run this in your terminal:
  
  npm run dev
  
  OR
  
  node start-with-restart.js

Benefits:
  • Bot automatically restarts if it exits
  • WhatsApp session is preserved
  • Great for development and production


METHOD 2: Standard Terminal
────────────────────────────────────────────────────
Run this:
  
  npm start
  
  OR
  
  node index.js

Note: Bot won't auto-restart, you'll need to manually restart


METHOD 3: WhatsApp Command (Owner Only)
────────────────────────────────────────────────────
Inside any chat:
  
  .restart
  .reboot
  .reload

The bot will:
  1. Send restart notification
  2. Gracefully close WhatsApp connection
  3. Exit process with code 0
  4. Terminal wrapper will auto-start it again


METHOD 4: PM2 Process Manager
────────────────────────────────────────────────────
Install PM2:
  
  npm install -g pm2

Start with PM2:
  
  pm2 start index.js --name nyx-md

Now .restart command will use PM2 for instant restart!


🔧 COMMAND USAGE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All these commands do the same thing (owner only):
  • .restart    - Standard restart
  • .reboot     - Alias for restart
  • .reload     - Alias for restart

Format:
  • Owner: <prefix>restart
  • Example: .restart


⚙️  HOW IT WORKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FLOW WITH AUTO-RESTART WRAPPER:
  1. User sends .restart command
  2. Bot sends "Restarting..." message
  3. restart.js closes WhatsApp socket
  4. Process exits with code 0
  5. start-with-restart.js detects exit code 0
  6. Automatically starts index.js again
  7. Bot reconnects to WhatsApp (session preserved)


FLOW WITH PM2:
  1. User sends .restart command
  2. Bot sends "Restarting..." message
  3. PM2 instantly restarts the process
  4. Bot maintains session immediately


🛡️  SAFETY FEATURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Restart limit: Max 10 restarts (prevents infinite loops)
✅ Anti-spam: 2-second minimum between restarts
✅ Graceful shutdown: Socket closes properly
✅ Error handling: Detects crash vs. graceful exit
✅ Session preservation: Auth folder is not deleted
✅ Owner only: Restart command requires owner permission


⚠️  TROUBLESHOOTING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem: "Restart failed!" message
Solution: Check console for errors, restart manually

Problem: Bot not restarting from terminal
Solution: Use "npm run dev" instead of "npm start"

Problem: .restart command not working
Solution: Make sure you're the owner (check config.js)

Problem: Too many restarts error
Solution: This prevents infinite loops. Check your code for issues.

Problem: WhatsApp session lost on restart
Solution: Auth folder should not be deleted. Check permissions.


📝 CONFIG (config.js):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Make sure these are set:
  • ownerNumber: ['your_number'] - For command access
  • botName: 'Your Bot Name' - Displayed on connect
  • ownerName: 'Your Name' - Displayed on connect


🎯 NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Verify config.js has correct ownerNumber
2. Start bot with: npm run dev
3. Test restart with: .restart (as owner)
4. Check console for logs
5. Verify bot automatically restarts


✅ DONE! Your restart system is ready to use!

For more help, check:
  • plugins/owner/restart.js
  • start-with-restart.js
  • config.js

`;

console.log(guide);
