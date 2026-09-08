const antidelete = require('../../lib/antidelete');

module.exports = {
  command: ['antidelete'],
  category: 'owner',
  description: 'Enable or disable antidelete (owner only)',
  ownerOnly: true,

  async execute(sock, m, args) {
    const match = args && args.length ? args[0].toLowerCase() : null;
    return antidelete.handleAntideleteCommand(sock, m.chat, m, match);
  }
};
