async function isGroupAdminOrBot(sock, m, config) {
    if (!m.isGroup) return false;

    const sender =
        m.key.participant || m.key.remoteJid;

    const botJid = sock.user.id;

    const ownerJids = config.ownerNumber.map(
        v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
    );

    if (ownerJids.includes(sender)) return true;
    if (sender === botJid) return true;

    const metadata = await sock.groupMetadata(m.chat);
    const admins = metadata.participants
        .filter(p => p.admin)
        .map(p => p.id);

    return admins.includes(sender);
}

module.exports = { isGroupAdminOrBot };
