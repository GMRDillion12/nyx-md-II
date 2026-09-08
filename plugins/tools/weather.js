const axios = require("axios")

module.exports = {
  command: ["weather"],
  category: "tools",
  description: "Check weather of a city",

  execute: async (sock, m, args) => {
    try {

      // React to command
      await sock.sendMessage(m.chat,{
        react:{text:"🌤️",key:m.key}
      })

      const city = args.join(" ")

      if(!city){
        return sock.sendMessage(
          m.chat,
          { text: "❌ Please provide a city.\nExample: .weather London" },
          { quoted:m }
        )
      }

      const apiKey = "4902c0f2550f58298ad4146a92b65e10"

      const res = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
      )

      const data = res.data

      const weatherText = `
🌍 *Weather Report*

📍 City: ${data.name}
🌡 Temperature: ${data.main.temp}°C
🤒 Feels Like: ${data.main.feels_like}°C
☁ Condition: ${data.weather[0].description}
💧 Humidity: ${data.main.humidity}%
💨 Wind Speed: ${data.wind.speed} m/s
`.trim()

      await sock.sendMessage(
        m.chat,
        { text: weatherText },
        { quoted:m }
      )

    } catch (err) {

      console.log("Weather error:",err)

      await sock.sendMessage(
        m.chat,
        { text:"❌ City not found or weather service unavailable." },
        { quoted:m }
      )

    }
  }
}
