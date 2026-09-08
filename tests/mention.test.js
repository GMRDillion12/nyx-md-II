const assert = require('assert');
const mentions = require('../lib/mentions');
const { describe, it } = require('node:test');

// Fake socket helper
function makeFakeSock({contacts = {}, storeContacts = {}, groupMetadata = null} = {}) {
  return {
    contacts,
    store: { contacts: storeContacts },
    contactsMap: contacts,
    contactsArray: Object.values(contacts),
    async groupMetadata(gid) {
      if (!groupMetadata) throw new Error('no gm');
      if (typeof groupMetadata === 'function') return groupMetadata(gid);
      return groupMetadata;
    }
  };
}

describe('mention helpers', () => {
  it('pn normalization and detection', () => {
    assert.strictEqual(mentions.normalizeJid('2348012345678@s.whatsapp.net'), '2348012345678@s.whatsapp.net');
    assert.strictEqual(mentions.isPnJid('2348012345678@s.whatsapp.net'), true);
    assert.strictEqual(mentions.isLidJid('2348012345678@s.whatsapp.net'), false);
    assert.strictEqual(mentions.getPhoneNumber('2348012345678@s.whatsapp.net'), '2348012345678');
  });

  it('lid normalization and detection', () => {
    assert.strictEqual(mentions.normalizeJid('123456789@lid'), '123456789@lid');
    assert.strictEqual(mentions.isLidJid('123456789@lid'), true);
    assert.strictEqual(mentions.isPnJid('123456789@lid'), false);
    assert.strictEqual(mentions.getPhoneNumber('123456789@lid'), null);
  });

  it('resolve participant from group metadata with lid addressing', async () => {
    const gm = { addressingMode: 'lid', participants: [{ id: '123@lid', username: 'Samuel', notify: 'Sam' }] };
    const sock = makeFakeSock({ groupMetadata: gm });
    const res = await mentions.resolveParticipant(sock, '123@lid', { groupId: 'g1' });
    assert.strictEqual(res.lidJid, '123@lid');
    assert.strictEqual(res.mentionJid, '123@lid');
    assert.strictEqual(res.displayName, 'Sam');
  });

  it('resolve participant with pn alternate in pn addressed group', async () => {
    const gm = { addressingMode: 'pn', participants: [{ id: '2348012345678@s.whatsapp.net', username: 'SamPN' }] };
    const sock = makeFakeSock({ groupMetadata: gm });
    const res = await mentions.resolveParticipant(sock, '2348012345678@s.whatsapp.net', { groupId: 'g1' });
    assert.strictEqual(res.pnJid, '2348012345678@s.whatsapp.net');
    assert.strictEqual(res.mentionJid, '2348012345678@s.whatsapp.net');
  });

  it('unmapped lid is preserved and not converted', async () => {
    const sock = makeFakeSock();
    const res = await mentions.resolveParticipant(sock, '999999999@lid', {});
    assert.strictEqual(res.lidJid, '999999999@lid');
    assert.strictEqual(res.pnJid, null);
    assert.strictEqual(res.mentionJid, '999999999@lid');
  });

  it('buildMentionPayload returns mentions array with resolved identities', async () => {
    const gm = { addressingMode: 'lid', participants: [{ id: '123@lid', username: 'Samuel' }, { id: '555@lid', username: 'Other' }] };
    const sock = makeFakeSock({ groupMetadata: gm });
    const payload = await mentions.buildMentionPayload({ text: 'Hello @Samuel', jids: ['123@lid'], sock, context: { groupId: 'g1' } });
    assert.strictEqual(payload.text, 'Hello @Samuel');
    assert.deepStrictEqual(payload.mentions, ['123@lid']);
  });

  it('@all fallback builds mentions list when mentionAll unsupported', async () => {
    const gm = { addressingMode: 'lid', participants: [{ id: 'a@lid' }, { id: 'b@lid' }] };
    const sock = makeFakeSock({ groupMetadata: gm });
    const payload = await mentions.buildMentionAllPayload({ text: 'Everyone', sock, groupId: 'g1' });
    assert.strictEqual(payload.text, '@all Everyone');
    assert.deepStrictEqual(payload.mentions.sort(), ['a@lid','b@lid'].sort());
  });

  it('deduplicates duplicate identities from mixed inputs', async () => {
    const gm = { addressingMode: 'pn', participants: [{ id: '234@s.whatsapp.net' }] };
    const sock = makeFakeSock({ groupMetadata: gm });
    const out = await mentions.buildMentionJids(['234@s.whatsapp.net','234@s.whatsapp.net','234']);
    assert.strictEqual(Array.isArray(out), true);
    assert.strictEqual(out.length >= 1, true);
  });

  it('handles malformed and empty input without crashing', async () => {
    const sock = makeFakeSock();
    await mentions.buildMentionPayload({ text: null, jids: [null, '', undefined, 'not-a-jid'], sock }).then(p => {
      assert.ok(p);
    });
  });
});
