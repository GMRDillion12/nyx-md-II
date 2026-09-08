const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const handler = require("../../lib/handler");

module.exports = {
    command: ["update"],
    category: "owner",
    description: "Update code from git, reload plugins, and optionally restart the bot process.",
    ownerOnly: true,

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;
        const repoPath = path.join(__dirname, "../../");
        const gitDir = path.join(repoPath, ".git");
        const restartRequested = args.some(arg => arg.toLowerCase() === "restart" || arg.toLowerCase() === "--restart");
        const noRestart = args.some(arg => arg.toLowerCase() === "no-restart" || arg.toLowerCase() === "--no-restart");
        const terminalDetected = process.stdin.isTTY && process.stdout.isTTY;
        const shouldRestart = restartRequested || (terminalDetected && !noRestart);

        await sock.sendMessage(chat, {
            text: "🔄 Update command started. Checking repository..."
        }, { quoted: m });

        let updateOutput = "";
        let gitSuccess = false;

        if (fs.existsSync(gitDir)) {
            try {
                updateOutput = await execCommand("git pull --ff-only", repoPath);
                gitSuccess = true;
            } catch (err) {
                updateOutput = err.message || String(err);
            }
        } else {
            updateOutput = "No .git folder found. Skipping git pull.";
        }

        // Reload plugins into current process when possible.
        // If we are running in a terminal, auto-restart to apply updates cleanly.
        let reloadError = null;
        if (!shouldRestart) {
            try {
                handler.reloadPlugins();
                handler.attachPlugins(sock);
            } catch (err) {
                reloadError = err;
            }
        }

        const statusMessage = `✅ Update completed.\n\nGit status:\n${updateOutput || "No output."}` +
            (reloadError ? `\n\n⚠️ Reload warning: ${reloadError.message || reloadError}` : "") +
            (shouldRestart && !restartRequested ? `\n\n🔁 Terminal detected: bot will restart automatically.` : "");

        await sock.sendMessage(chat, { text: statusMessage }, { quoted: m });

        // React to confirm completion
        try {
            await sock.sendMessage(chat, {
                react: { text: "✅", key: m.key }
            });
        } catch (e) {
            // ignore reaction errors
        }

        if (shouldRestart) {
            await sock.sendMessage(chat, {
                text: "🔁 Restarting bot now to apply updates and preserve auth/session..."
            }, { quoted: m });

            const nodePath = process.execPath;
            const entryPoint = path.join(repoPath, "index.js");
            const child = spawn(nodePath, [entryPoint], {
                cwd: repoPath,
                stdio: "inherit"
            });

            child.on("error", err => {
                console.error("Failed to restart bot process:", err);
            });

            child.on("spawn", () => {
                process.exit(0);
            });

            // safety fallback
            setTimeout(() => process.exit(0), 3000);
        }
    }
};

function execCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd, timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`${stdout || ""}${stderr || ""}`.trim() || error.message));
            }
            resolve(`${stdout || ""}${stderr || ""}`.trim());
        });
    });
}
