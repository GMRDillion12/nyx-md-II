const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const settingsModule = require('../plugins/owner/settings');
const handler = require('../lib/handler');
const { loadUserGroupData, saveUserGroupData } = require('../lib/database');
const hangman = require('../plugins/fun/hangman');
const ttt = require('../plugins/fun/tictactoe');

function createTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nyx-settings-'));
}

test('resolveToggleState reports enabled state from autotyping config', () => {
  const dataDir = createTempDataDir();
  const autotypingPath = path.join(dataDir, 'autotyping.json');
  fs.writeFileSync(autotypingPath, JSON.stringify({ enabled: true }, null, 2));

  const result = settingsModule.resolveToggleState('autotyping', {
    dataDir,
    groupId: null,
    autoReactData: { enabled: false, mode: 'bot' },
    userGroupData: {},
    groupSettings: {},
    configValues: { selfMode: false }
  });

  assert.equal(result.state, '✅ ON');
});

test('resolveToggleState reports group-specific toggle state from userGroupData', () => {
  const dataDir = createTempDataDir();
  const userGroupData = {
    welcome: {
      '123@g.us': { enabled: true }
    },
    groupSettings: {
      '123@g.us': {
        autosticker: true
      }
    }
  };

  const welcomeResult = settingsModule.resolveToggleState('welcome', {
    dataDir,
    groupId: '123@g.us',
    autoReactData: { enabled: false, mode: 'bot' },
    userGroupData,
    groupSettings: userGroupData.groupSettings,
    configValues: { selfMode: false }
  });

  const autostickerResult = settingsModule.resolveToggleState('autosticker', {
    dataDir,
    groupId: '123@g.us',
    autoReactData: { enabled: false, mode: 'bot' },
    userGroupData,
    groupSettings: userGroupData.groupSettings,
    configValues: { selfMode: false }
  });

  assert.equal(welcomeResult.state, '✅ ON');
  assert.equal(autostickerResult.state, '✅ ON');
});

test('resolveToggleState reports ghost group state and the ghost plugin is registered', () => {
  const dataDir = createTempDataDir();
  const userGroupData = {
    ghost: {
      '123@g.us': { enabled: true }
    }
  };

  const ghostResult = settingsModule.resolveToggleState('ghost', {
    dataDir,
    groupId: '123@g.us',
    autoReactData: { enabled: false, mode: 'bot' },
    userGroupData,
    groupSettings: {},
    configValues: { selfMode: false }
  });

  const ghostPlugin = require('../plugins/owner/ghost');

  assert.equal(ghostResult.state, '✅ ON');
  assert.ok(ghostPlugin && ghostPlugin.command);
});

test('handler ignores commands in ghosted groups but allows .ghost itself', async () => {
  const chatId = '1234567890-123@g.us';
  const data = loadUserGroupData();
  data.ghost = data.ghost || {};
  data.ghost[chatId] = { enabled: true };
  saveUserGroupData(data);

  let sentMessages = [];
  const sock = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (target, payload) => {
      sentMessages.push({ target, payload });
      return { key: { remoteJid: target } };
    }
  };

  await handler(sock, { chat: chatId, key: { remoteJid: chatId } }, '.about', {
    ownerNumber: ['1234567890'],
    botName: 'Nyx',
    ownerName: 'Owner',
    prefix: '.'
  });

  assert.deepEqual(sentMessages, []);

  await handler(sock, { chat: chatId, key: { remoteJid: chatId } }, '.1', {
    ownerNumber: ['1234567890'],
    botName: 'Nyx',
    ownerName: 'Owner',
    prefix: '.'
  });

  assert.deepEqual(sentMessages, []);

  await handler(sock, { chat: chatId, key: { remoteJid: chatId } }, '.ghost status', {
    ownerNumber: ['1234567890'],
    botName: 'Nyx',
    ownerName: 'Owner',
    prefix: '.'
  });

  assert.equal(sentMessages.length, 1);
  assert.match(String(sentMessages[0].payload.text), /Ghosted Groups|No groups/i);

  delete data.ghost[chatId];
  saveUserGroupData(data);
});

test('group leaderboard helpers use group subject names instead of raw ids', async () => {
  const chatId = '1234567890-123@g.us';
  const sock = {
    groupMetadata: async () => ({ subject: 'Dream Team' })
  };

  const hangmanLabel = await hangman.resolveGroupLabel(sock, chatId);
  const tttLabel = await ttt.resolveGroupLabel(sock, chatId);

  assert.equal(hangmanLabel, 'Dream Team');
  assert.equal(tttLabel, 'Dream Team');
});

test('resolveToggleState returns unknown when no state evidence is available', () => {
  const result = settingsModule.resolveToggleState('unknown_toggle', {
    dataDir: createTempDataDir(),
    groupId: null,
    autoReactData: { enabled: false, mode: 'bot' },
    userGroupData: {},
    groupSettings: {},
    configValues: { selfMode: false }
  });

  assert.equal(result.state, '❓ UNKNOWN');
});
