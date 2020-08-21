const faceIt = require("./faceIt.js")
const Discord = require("discord.js")
const config = require("./config.json")
const client = new Discord.Client()

client.on("ready", () => {
    console.log("I am ready!")
})

client.on("message", (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return
    // if (message.content.indexOf(config.prefix) !== 0) return
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase()

    if (command === 'stats') {
        const player = args[0]
        message.channel.send(config.baseURL + player)
    } else if (command === 'stats20') {
        const player = args[0]
        message.channel.send(config.baseURL + player)
    } else if (command === 'match') {
        // parse matchId
        const result = faceIt.matchHandler(args[0])
    }
})


client.login(config.token)
