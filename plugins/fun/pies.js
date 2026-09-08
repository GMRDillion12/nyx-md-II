module.exports = {
  command: ["pies"],
  category: "fun",
  description: "Get pies images from different countries",

  execute: async (sock, m, args) => {

    const countries = [
      "india","malaysia","thailand","china",
      "indonesia","japan","korea","vietnam"
    ];

    const country = args[0]?.toLowerCase();

    if (!country) {
      return sock.sendMessage(
        m.chat,
        {
          text: `Usage: .pies <country>\n\nAvailable:\n${countries.join(", ")}`
        },
        { quoted: m }
      );
    }

    if (!countries.includes(country)) {
      return sock.sendMessage(
        m.chat,
        { text: `❌ Invalid country.\n\n${countries.join(", ")}` },
        { quoted: m }
      );
    }

    const url = `https://api.shizo.top/pies/${country}?apikey=shizo`;

    await sock.sendMessage(
      m.chat,
      {
        image: { url: url },
        caption: `🍑 Pies (${country})`
      },
      { quoted: m }
    );
  }
};
