const fs = require('fs');
const path = require('path');
const pluginsDir = path.join(__dirname, 'plugins');
function walk(dir) {
  const all = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) all.push(...walk(p));
    else if (stat.isFile() && p.endsWith('.js')) all.push(p);
  }
  return all;
}
const files = walk(pluginsDir);
const toggleLineRegex = /(?:on\s*(?:\/|\||)\s*off|on\s+off|on\/off|on\s*\|\s*off|toggle|enable|disable)/i;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  let plugin = null;
  try {
    delete require.cache[require.resolve(file)];
    plugin = require(file);
  } catch (e) {}
  const candidateCommands = plugin && plugin.command ? (Array.isArray(plugin.command) ? plugin.command : [plugin.command]) : [];
  const hasToggleUsage =
    (plugin && plugin.usage && toggleLineRegex.test(String(plugin.usage))) ||
    (plugin && plugin.description && toggleLineRegex.test(String(plugin.description))) ||
    toggleLineRegex.test(text);
  if (candidateCommands.length && hasToggleUsage) {
    console.log('DETECTED', path.relative(__dirname, file), candidateCommands, plugin?.usage, plugin?.description);
  } else if (toggleLineRegex.test(text)) {
    const usageMatch = text.match(/usage\s*:\s*['\"`]\.([a-zA-Z0-9-_]+)/i);
    const cmdMatch = text.match(/command\s*:\s*\[\s*['\"`]([a-zA-Z0-9-_]+)['\"`]/i);
    console.log('FALLBACK', path.relative(__dirname, file), usageMatch?.[1] || '', cmdMatch?.[1] || '');
  }
}
