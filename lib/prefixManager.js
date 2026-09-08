const fs = require("fs");
const path = require("path");

const prefixFile = path.join(__dirname, "../data/prefix.json");
let prefixCache = null;

function initPrefixFile() {
    if (!fs.existsSync(prefixFile)) {
        fs.mkdirSync(path.dirname(prefixFile), { recursive: true });
        fs.writeFileSync(prefixFile, JSON.stringify({ prefix: "." }, null, 2));
        prefixCache = ".";
    }
}

function loadPrefix() {
    if (prefixCache !== null) return prefixCache;
    initPrefixFile();

    try {
        const data = fs.readFileSync(prefixFile, "utf8");
        const parsed = JSON.parse(data);
        prefixCache = parsed.prefix || ".";
    } catch (err) {
        console.error("Error reading prefix:", err.message);
        prefixCache = ".";
    }

    return prefixCache;
}

function getPrefix() {
    return loadPrefix();
}

function setPrefix(newPrefix) {
    try {
        initPrefixFile();
        const data = { prefix: newPrefix };
        fs.writeFileSync(prefixFile, JSON.stringify(data, null, 2));
        prefixCache = newPrefix;
        return true;
    } catch (err) {
        console.error("Error writing prefix:", err.message);
        return false;
    }
}

module.exports = {
    getPrefix,
    setPrefix,
    initPrefixFile
};
