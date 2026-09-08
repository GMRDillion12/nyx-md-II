const add = require('../lib/removedMembers');

console.log('Testing getRemovedMembers for group 120363427468421416@g.us');
const members = add.getRemovedMembers('120363427468421416@g.us');
console.log('Members keys:', Object.keys(members));
console.log('First member value:', Object.values(members)[0]);

console.log('\nTesting normalizeUserJid:');
['197573226807432@lid','198917501231217@s.whatsapp.net','2348129275261','abc'].forEach(x=>{
  try{
    console.log(x,'->', add.normalizeUserJid ? add.normalizeUserJid(x) : 'no normalizeUserJid export');
  }catch(e){console.error(e)}
});
