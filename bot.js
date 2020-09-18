import Discord from "discord.js"
import config from "./config.json"
import {getPlayerStats, getPlayerStats20} from "./faceIt.js"
const client = new Discord.Client()

const winEmoji = ":green_square:"
const lossEmoji = ":red_square:"

client.on("ready", () => {
    console.log("I am ready!")
})

client.on("message", async (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase()
    if (command === 'stats') {
        const player = args[0]
        const stats = await getPlayerStats(player)
        const embed = {
            "title": player+"'s FaceIt page",
            "url": "https://www.faceit.com/en/players/"+player,
            "color": 12345678,
            "thumbnail": {
              "url": stats.avatar
            },
            "author": {
              "name": player,
              "url": "https://www.faceit.com/en/players/"+player,
              "icon_url": stats.skill_img
            },
            "fields": [
              {
                "name": "Recent Results",
                "value": stats.recent_results.map(a => a==='1' ? winEmoji : lossEmoji).join(" , ")
              },
              {
                "name": "Elo",
                "value": stats.elo
              },
              {
                "name": "K/D Ratio",
                "value": stats.kdr
              },
              {
                "name": "Average HS%",
                "value": stats.average_hs
              },
              {
                "name": "Best Map",
                "value": "Winrate "+stats.best_map["mapWR"]+"% on map "+stats.best_map["map"]
              }
            ]
          };
          message.channel.send({ embed });
    } else if (command === 'stats20') {
        const player = args[0]
        getPlayerStats20("")
        message.channel.send(config.baseURL + player)
    } else if (command === 'match') {
        const result = FaceIt.matchHandler(args[0])
    }
})




client.login(config.token)
