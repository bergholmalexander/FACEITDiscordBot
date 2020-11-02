import Discord from "discord.js"
import config from "./config.json"
import {
	bestWinRate,
	getPlayerStats,
	getPlayerStats20,
	matchHandler,
} from "./faceIt.js"
const client = new Discord.Client()

const winEmoji = ":green_square:"
const lossEmoji = ":red_square:"

client.on("ready", () => {
	console.log("FaceIt Discord Bot is live")
})

client.on("message", async (message) => {
	if (!message.content.startsWith(config.prefix) || message.author.bot) return
	const args = message.content.slice(config.prefix.length).trim().split(/ +/g)
	const command = args.shift().toLowerCase()
	if (command === "stats") {
		const player = args[0]
		const stats = await getPlayerStats(player)
		const embed = {
			title: player + "'s Lifetime FACEIT Stats",
			url: "https://www.faceit.com/en/players/" + player,
			color: 12345678,
			thumbnail: {
				url: stats.avatar,
			},
			author: {
				name: player,
				url: "https://www.faceit.com/en/players/" + player,
				icon_url: stats.skill_img,
			},
			fields: [
				{
					name: "Recent Results",
					value: stats.recent_results
						.map((a) => (a === "1" ? winEmoji : lossEmoji))
						.join(" , "),
				},
				{
					name: "Elo",
					value: stats.elo,
				},
				{
					name: "K/D Ratio",
					value: stats.kdr,
				},
				{
					name: "Average HS%",
					value: stats.average_hs,
				},
				{
					name: "Best Map",
					value:
						"Winrate " +
						stats.best_map["mapWR"] +
						"% on map " +
						stats.best_map["map"],
				},
			],
		}
		message.channel.send({ embed })
	} else if (command === "stats20") {
		const player = args[0]
		const stats = await getPlayerStats(player)
		const stats20 = await getPlayerStats20(stats["player_id"])
		if (Object.keys(stats20).length === 0) {
			message.channel.send(
				"The player does not have any matches played in the last month."
      )
      return
		}
		const embed = {
			title: player + "'s 20-game average FACEIT stats",
			url: "https://www.faceit.com/en/players/" + player,
			color: 12345678,
			thumbnail: {
				url: stats.avatar,
			},
			author: {
				name: player,
				url: "https://www.faceit.com/en/players/" + player,
				icon_url: stats.skill_img,
			},
			fields: [
				{
					name: "Average Kills",
					value: Math.ceil(stats20.Kills),
				},
				{
					name: "Average Headshots %",
					value: stats20["Headshots %"],
				},
				{
					name: "Average K/D",
					value: stats20["K/D Ratio"].toFixed(2),
				},
				{
					name: "Average K/R",
					value: stats20["K/R Ratio"].toFixed(2),
				},
				{
					name: "Highest WR Map last 20 games",
					value:
						player +
						"'s best map is " +
						stats20["highest_map"] +
						" with a winrate of " +
						stats20["highest_wr"] +
						"% with " +
						stats20["highest_wins"] +
						" wins and " +
						stats20["highest_losses"] +
						" losses.",
				},
			],
		}
		// TODO: Would be interesting to get best map in last 20 matches as well
		message.channel.send({ embed })
	} else if (command === "match") {
		const result = await matchHandler(args[0])
		console.log(bestWinRate(result.teamOne, result.teamTwo))
	}
})

client.login(config.token)
