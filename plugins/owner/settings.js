const fs = require('fs');
const path = require('path');
const config = require('../../config');

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const txt = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(txt);
  } catch (_error) {
    return fallback;
  }
}

function normalizeEnabledValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'on', 'yes', 'enable', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'off', 'no', 'disable', 'disabled'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function resolveToggleState(name, context) {
  const {
    dataDir,
    groupId,
    autoReactData,
    userGroupData,
    groupSettings,
    configValues
  } = context || {};

  const fallbackEnabled = Boolean(configValues?.selfMode ? false : false);

  if (name === 'mode') {
    return { state: configValues?.selfMode ? '🔒 Private' : '🌐 Public' };
  }

  if (name === 'autoreact') {
    if (groupId && userGroupData?.groups && typeof userGroupData.groups[groupId] === 'object') {
      const groupToggle = userGroupData.groups[groupId];
      const enabled = normalizeEnabledValue(groupToggle?.enabled, false);
      const mode = groupToggle?.mode || autoReactData?.mode || 'bot';
      return { state: enabled ? `✅ ON (${String(mode).toUpperCase()})` : '❌ OFF' };
    }

    if (groupId && groupSettings?.autoreact) {
      const value = groupSettings.autoreact;
      if (typeof value === 'object' && value !== null) {
        const enabled = normalizeEnabledValue(value.enabled, false);
        const mode = value.mode || autoReactData?.mode || 'bot';
        return { state: enabled ? `✅ ON (${String(mode).toUpperCase()})` : '❌ OFF' };
      }
    }

    if (groupId && autoReactData?.groups?.[groupId]) {
      const groupToggle = autoReactData.groups[groupId];
      const enabled = normalizeEnabledValue(groupToggle?.enabled, false);
      const mode = groupToggle?.mode || autoReactData?.mode || 'bot';
      return { state: enabled ? `✅ ON (${String(mode).toUpperCase()})` : '❌ OFF' };
    }

    const enabled = normalizeEnabledValue(autoReactData?.enabled, false);
    const mode = autoReactData?.mode || 'bot';
    return { state: enabled ? `✅ ON (${String(mode).toUpperCase()})` : '❌ OFF' };
  }

  if (groupId) {
    const namedGroupEntry = userGroupData?.[name]?.[groupId];
    if (namedGroupEntry) {
      const enabled = normalizeEnabledValue(namedGroupEntry.enabled, false);
      return { state: enabled ? '✅ ON' : '❌ OFF' };
    }

    const scopedGroupSettings = groupId && groupSettings && typeof groupSettings === 'object' && !Array.isArray(groupSettings)
      ? (groupSettings[groupId] && typeof groupSettings[groupId] === 'object' ? groupSettings[groupId] : groupSettings)
      : groupSettings;

    const groupSettingsEntry = scopedGroupSettings?.[name] ?? groupSettings?.[groupId]?.[name] ?? groupSettings?.[name];
    if (groupSettingsEntry !== undefined) {
      if (typeof groupSettingsEntry === 'boolean') {
        return { state: groupSettingsEntry ? '✅ ON' : '❌ OFF' };
      }
      if (typeof groupSettingsEntry === 'object' && groupSettingsEntry !== null) {
        if ('enabled' in groupSettingsEntry) {
          return { state: normalizeEnabledValue(groupSettingsEntry.enabled, false) ? '✅ ON' : '❌ OFF' };
        }
        if ('value' in groupSettingsEntry) {
          return { state: normalizeEnabledValue(groupSettingsEntry.value, false) ? '✅ ON' : '❌ OFF' };
        }
      }
      if (typeof groupSettingsEntry === 'string') {
        return { state: normalizeEnabledValue(groupSettingsEntry, false) ? '✅ ON' : '❌ OFF' };
      }
    }

    if (name === 'prank') {
      const prankEntry = userGroupData?.prank?.[groupId];
      if (prankEntry) {
        return { state: normalizeEnabledValue(prankEntry.enabled, false) ? '✅ ON' : '❌ OFF' };
      }
    }
  }

  const configFilePath = path.join(dataDir, `${name}.json`);
  if (fs.existsSync(configFilePath)) {
    try {
      const json = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      if (typeof json === 'boolean') {
        return { state: json ? '✅ ON' : '❌ OFF' };
      }
      if (typeof json === 'object' && json !== null) {
        const enabled = normalizeEnabledValue(json.enabled, fallbackEnabled);
        if ('enabled' in json || 'value' in json) {
          return { state: enabled ? '✅ ON' : '❌ OFF' };
        }
      }
      if (typeof json === 'string') {
        return { state: normalizeEnabledValue(json, fallbackEnabled) ? '✅ ON' : '❌ OFF' };
      }
    } catch (error) {
      // fall through to unknown
    }
  }

  if (groupId && userGroupData?.[name] && typeof userGroupData[name] === 'object' && userGroupData[name][groupId] === false) {
    return { state: '❌ OFF' };
  }

  return { state: '❓ UNKNOWN' };
}

module.exports = {
  resolveToggleState,
  command: ['settings', 'list'],
  category: 'owner',
  description: 'Show detected toggle commands and their current states',
  usage: '.settings (run in chat or group)',
  ownerOnly: true,

  async execute(sock, m, args, configArg) {
    try {
      const chatId = m.chat || m.key?.remoteJid;
      const isGroup = chatId?.endsWith('@g.us');
      const dataDir = path.join(__dirname, '..', '..', 'data');

      const autoReact = readJsonSafe(path.join(dataDir, 'autoReact.json'), { enabled: false, mode: 'bot' });
      const userGroupData = readJsonSafe(path.join(dataDir, 'userGroupData.json'), {
        antilink: {},
        antibadword: {},
        welcome: {},
        goodbye: {},
        chatbot: {},
        prank: {},
        ghost: {},
        antitag: {},
        antistatus: {},
        groupSettings: {}
      });

      const groupId = isGroup ? chatId : null;
      const groupAutoReact = groupId ? autoReact.groups?.[groupId] : null;
      const autoReactText = groupId
        ? groupAutoReact
          ? `ON (${groupAutoReact.mode.toUpperCase()})`
          : `${autoReact.enabled ? 'ON' : 'OFF'} (Global ${autoReact.mode.toUpperCase()})`
        : `${autoReact.enabled ? 'ON' : 'OFF'} (${autoReact.mode.toUpperCase()})`;

      // helper: recursively walk plugins folder and read .js files
      function walk(dir) {
        const all = [];
        try {
          for (const name of fs.readdirSync(dir)) {
            const p = path.join(dir, name);
            const stat = fs.statSync(p);
            if (stat.isDirectory()) all.push(...walk(p));
            else if (stat.isFile() && p.endsWith('.js')) all.push(p);
          }
        } catch (e) {}
        return all;
      }

      const pluginsDir = path.join(__dirname, '..');
      const pluginFiles = walk(pluginsDir);

      const toggles = new Map(); // name -> { command, category, description }
      const groupToggleNames = new Set([
        'antilink',
        'antistatus',
        'antibadword',
        'welcome',
        'goodbye',
        'chatbot',
        'prank',
        'antitag'
      ]);
      const knownToggleCommands = new Set([
        ...groupToggleNames,
        'autosticker',
        'antidelete',
        'autoreact',
        'autotyping',
        'mode'
      ]);
      const excludedToggleCommands = new Set(['settings', 'list']);
      const toggleLineRegex = /\b(?:on\s*(?:\/|\||)?\s*off|on\s+off|on\/off|enable|disable|toggle|switch|private\/public|public\/private|set\s+(?:bot|all))\b/i;
      const commandListRegex = /command\s*:\s*(\[[\s\S]*?\]|['"`][^'"`]+['"`])/i;
      const usageRegex = /usage\s*:\s*['"`]([^'"`]+)['"`]/i;
      const descriptionRegex = /description\s*:\s*['"`]([^'"`]+)['"`]/i;
      const categoryRegex = /category\s*:\s*['"`]([^'"`]+)['"`]/i;

      function escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      function getCommandToggleRegex(command) {
        const safeCommand = escapeRegex(command);
        return new RegExp(`\\.${safeCommand}[^\\n]{0,120}(?:${toggleLineRegex.source})`, 'i');
      }

      function hasCommandToggleText(commands, text) {
        if (!commands || commands.length === 0) return false;
        for (const command of commands) {
          const regex = getCommandToggleRegex(command);
          if (regex.test(text)) return true;
        }
        return false;
      }

      function addToggleCommands(commands, category, description) {
        const list = Array.isArray(commands) ? commands : [commands];
        for (const cmd of list) {
          if (!cmd || typeof cmd !== 'string') continue;
          const key = cmd.toLowerCase();
          if (toggles.has(key)) continue;
          toggles.set(key, { command: key, category: category || '', description: description || '' });
        }
      }

      function normalizeCommands(text) {
        const cmds = [];
        const match = commandListRegex.exec(text);
        if (!match) return cmds;

        const arrayText = match[1];
        if (arrayText.startsWith('[')) {
          const stringRegex = /['"`]([a-zA-Z0-9-_]+)['"`]/g;
          let item;
          while ((item = stringRegex.exec(arrayText))) {
            if (item[1]) cmds.push(item[1].toLowerCase());
          }
        } else {
          const simpleMatch = arrayText.match(/['"`]([a-zA-Z0-9-_]+)['"`]/);
          if (simpleMatch) cmds.push(simpleMatch[1].toLowerCase());
        }

        return cmds;
      }

      function extractProperty(text, regex) {
        const match = regex.exec(text);
        return match ? match[1] : '';
      }

      for (const file of pluginFiles) {
        let plugin = null;
        let text = '';

        try {
          text = fs.readFileSync(file, 'utf8');
        } catch (e) {
          text = '';
        }

        try {
          delete require.cache[require.resolve(file)];
          plugin = require(file);
        } catch (err) {
          plugin = null;
        }

        let fileCommands = plugin && plugin.command
          ? (Array.isArray(plugin.command) ? plugin.command.map(c => String(c).toLowerCase()) : [String(plugin.command).toLowerCase()])
          : normalizeCommands(text);

        fileCommands = fileCommands.filter(cmd => !excludedToggleCommands.has(cmd));
        if (fileCommands.length === 0) continue;

        const category = plugin?.category || extractProperty(text, categoryRegex);
        const description = plugin?.description || extractProperty(text, descriptionRegex);
        const usage = plugin?.usage || extractProperty(text, usageRegex);
        const hasToggleUsage = toggleLineRegex.test(usage) || toggleLineRegex.test(description) || hasCommandToggleText(fileCommands, text);
        const isKnownToggle = fileCommands.some(cmd => knownToggleCommands.has(cmd));

        if (fileCommands.length > 0 && (hasToggleUsage || isKnownToggle)) {
          addToggleCommands(fileCommands, category, description);
        }
      }

      // always include core toggles
      for (const t of ['mode', 'autoreact']) {
        if (!toggles.has(t)) {
          toggles.set(t, { command: t, category: 'core', description: '' });
        }
      }

      // resolve current state for each toggle
      const toggleStates = [];
      const groupSettings = groupId ? userGroupData.groupSettings?.[groupId] || {} : {};

      for (const [name, meta] of toggles) {
        const resolved = resolveToggleState(name, {
          dataDir,
          groupId,
          autoReactData: autoReact,
          userGroupData,
          groupSettings,
          configValues: { selfMode: config.selfMode }
        });

        toggleStates.push({ name, state: resolved.state, category: meta.category });
      }

      const lines = [];
      lines.push('╭━━★彡 Nyx-MD 彡★━━╮');
      lines.push(`┃ Bot: ${config.botName}   • Owner: ${config.ownerName}`);
      lines.push('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push(`┃ Mode: ${config.selfMode ? '🔒 Private' : '🌐 Public'}`);
      lines.push(`┃ Auto-Reaction: ${autoReactText}`);
      if (groupId) {
        lines.push(`┃ Group: ${groupId}`);
        if (groupAutoReact) lines.push(`┃ Group Auto-Reaction: ✅ ON (${groupAutoReact.mode})`);
      }
      lines.push('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('*Detected Toggles*');
      if (toggleStates.length === 0) {
        lines.push('• No toggle commands detected.');
      } else {
        const sorted = toggleStates.sort((a, b) => a.name.localeCompare(b.name));
        sorted.forEach(t => lines.push(`• .${t.name} — ${t.state}`));
      }
      lines.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push('💡 Tip: Toggles auto-detected from plugin exports.');

      await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: m });
    } catch (error) {
      console.error('[settings] error:', error);
      await sock.sendMessage(chatId, { text: '❌ Failed to load settings.' }, { quoted: m });
    }
  }
};
