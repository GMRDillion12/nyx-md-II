const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'plugins', 'interactions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'fetchGif.js');
for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const oldContent = content;
  content = content.replace(/const url = await fetchGif\('([^']+)'\);/g, "const { buffer, mimetype } = await fetchGif('$1');");
  content = content.replace(/video:\s*\{\s*url\s*\},/g, 'video: buffer, mimetype,');
  if (content !== oldContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('patched', file);
  } else {
    console.log('unchanged', file);
  }
}
