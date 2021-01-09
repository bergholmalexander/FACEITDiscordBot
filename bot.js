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
const faceitAvatarURL =
	"https://pbs.twimg.com/profile_images/1143140925696368640/xgPqiB58_400x400.png"
const baseURL = "https://www.faceit.com/en/players/"
const baseRoomURL = "https://www.faceit.com/en/csgo/room/"

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
		if (Object.keys(stats).length === 0) {
			message.reply("There was no player found with the name " + args[0] + ".")
		}
		const embed = {
			title: player + "'s Lifetime FACEIT Stats",
			url: baseURL + player,
			color: 12345678,
			thumbnail: {
				url: stats.avatar,
			},
			author: {
				name: player, // Adding the flag is cumbersome although the data is accessible --> easiest method i.e. copy pasting the flag "🇫🇮"
				url: baseURL + player,
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
		message.reply({ embed })
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
			url: baseURL + player,
			color: 12345678,
			thumbnail: {
				url: stats.avatar,
			},
			author: {
				name: player,
				url: baseURL + player,
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
						stats20["highest_wr"].toFixed(2) +
						"% with " +
						stats20["highest_wins"] +
						" wins and " +
						stats20["highest_losses"] +
						" losses.",
				},
			],
		}
		message.reply({ embed })
	} else if (command === "match") {
		const result = await matchHandler(args[0])
		const finalResults = bestWinRate(result.teamOne, result.teamTwo)
		const embed = {
			title: "Match ID " + args[0],
			url: baseRoomURL + args[0],
			color: 12345678,
			thumbnail: {
				url: faceitAvatarURL,
			},
			author: {
				name: "Click here to go to the match room",
				url: baseRoomURL + args[0],
				// icon_url: stats.skill_img,
			},
			fields: [
				{
					name: "Team1",
					value: "Team1's stats",
				},
				{
					name: "Highest Winrate %",
					value:
						finalResults.highestWROne + "% on " + finalResults.highestMapOne,
				},
				{
					name: "Lowest Winrate %",
					value: finalResults.lowestWROne + "% on " + finalResults.lowestMapOne,
				},
				{
					name: "Highest % difference",
					value:
						finalResults.choiceWROne.toString() +
						"% higher winrate on " +
						finalResults.choiceOne.toString() +
						" compared to team 2's " +
						(finalResults.choiceWRMapOne - finalResults.choiceWROne)
							.toFixed(2)
							.toString() +
						"% winrate",
				},
				{
					name: "Team2",
					value: "Team2's stats",
				},
				{
					name: "Highest Winrate %",
					value:
						finalResults.highestWRTwo + "% on " + finalResults.highestMapTwo,
				},
				{
					name: "Lowest Winrate %",
					value: finalResults.lowestWRTwo + "% on " + finalResults.lowestMapTwo,
				},
				{
					name: "Highest % difference",
					value:
						finalResults.choiceWRTwo.toString() +
						"% higher winrate on " +
						finalResults.choiceTwo.toString() +
						" compared to team 1's " +
						(finalResults.choiceWRMapTwo - finalResults.choiceWRTwo)
							.toFixed(2)
							.toString() +
						"% winrate",
				},
			],
		}
		// TODO: Would be interesting to get best map in last 20 matches as well
		message.reply({ embed })
	}
})

client.login(config.token)
