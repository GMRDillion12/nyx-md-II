const qrcode = require('qrcode-terminal');

const qr = "PASTE_THE_QR_TEXT_HERE";
qrcode.generate(qr, { small: true });

