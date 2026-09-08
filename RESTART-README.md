# 🔄 NYX-MD Restart System

Complete restart functionality for your bot - both via WhatsApp commands and terminal auto-restart.

## ✨ What's Included

- **plugins/owner/restart.js** - WhatsApp command `.restart` (owner only)
- **start-with-restart.js** - Terminal wrapper that auto-restarts the bot
- **package.json** - Updated with `npm run dev` and `npm run restart` commands

## 🚀 Quick Start

### Option 1: Terminal with Auto-Restart (RECOMMENDED)
```bash
npm run dev
```
The bot will auto-restart when using `.restart` command!

### Option 2: Just Start the Bot
```bash
npm start
```

### Option 3: WhatsApp Command
Send to bot (owner only):
```
.restart
.reboot
.reload
```

## 📋 How It Works

### Terminal Auto-Restart Flow
1. User sends `.restart` command
2. Bot sends restart notification
3. Process exits gracefully (code 0)
4. `start-with-restart.js` detects this
5. Automatically starts bot again
6. WhatsApp session is preserved

### With PM2
If you have PM2 installed, `.restart` will use it for instant restart:
```bash
npm install -g pm2
pm2 start index.js --name nyx-md
```

## ⚙️ Features

✅ **Graceful Shutdown** - Socket connection closes properly
✅ **Session Preservation** - Auth folder is untouched
✅ **Safety Limits** - Prevents infinite restart loops
✅ **Owner Only** - Requires owner permission
✅ **Multiple Aliases** - Use .restart, .reboot, or .reload
✅ **PM2 Support** - Works with PM2 process manager
✅ **Error Handling** - Detects crashes vs. graceful exits

## 🔧 Commands

Send as owner in any chat:

```
.restart   - Restart the bot
.reboot    - Alias for restart
.reload    - Alias for restart
```

## ⚠️ Important Notes

1. **Make sure `config.js` has your number** in `ownerNumber`:
   ```javascript
   ownerNumber: ['1234567890']  // Your WhatsApp number
   ```

2. **Use `npm run dev`** for auto-restart functionality

3. **Auth folder is preserved** - Session stays active across restarts

4. **Maximum 10 restarts** - Prevents infinite loops on startup errors

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| Restart command not working | Check you're the owner in config.js |
| Bot doesn't auto-restart | Use `npm run dev` instead of `npm start` |
| "Too many restarts" error | Check for startup errors in console |
| Session lost on restart | Auth folder should not be deleted |

## 📚 Files Reference

### restart.js
- Command: `/plugins/owner/restart.js`
- Handles WhatsApp restart command
- Gracefully closes socket
- Supports PM2 and process.exit()

### start-with-restart.js
- Wrapper script for terminal
- Auto-restarts on code 0 exit
- Anti-spam protection
- Restart limit enforcement

### RESTART-SETUP.js
- View this for detailed setup guide: `node RESTART-SETUP.js`

## 💡 Tips

- **Development**: Use `npm run dev` for auto-restart
- **Production**: Use `npm start` or PM2
- **Testing**: Send `.restart` from your WhatsApp to test
- **Monitoring**: Check console logs during restart

## ✅ Verification

To verify everything is working:

1. Start bot: `npm run dev`
2. Bot connects and shows "✅ Nyx-MD connected!"
3. Send `.restart` from your WhatsApp
4. Bot should show "🔁 Restarting bot..." message
5. Bot automatically restarts and reconnects
6. Console shows "🚀 Starting bot (Attempt 2)..."

## 📞 Support

Check these files for more details:
- `plugins/owner/restart.js` - Command implementation
- `start-with-restart.js` - Terminal wrapper
- `config.js` - Configuration
- `lib/handler.js` - Command routing

---

**Status**: ✅ Ready to use!
