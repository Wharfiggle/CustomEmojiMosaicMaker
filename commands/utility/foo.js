const { SlashCommandBuilder } = require("discord.js");

const wait = require('node:timers/promises').setTimeout;

module.exports = 
{
	cooldown: 5,
	data: new SlashCommandBuilder().setName("foo").setDescription("Test command.")
	.addStringOption(option =>
		option.setName('option')
			.setDescription('Choose an option')
			.setRequired(false)
			.addChoices(
				{ name: 'Test 1', value: 't1' },
				{ name: 'Test 2', value: 't2' }
			)),
	async execute(interaction) 
	{
		const option = interaction.options.getString("option");
		if(option == "t1")
		{
			//defer the reply so the bot can take longer than 3 seconds to reply
			//cannot take longer than 15 minutes as the interaction token will expire
			await interaction.deferReply();
			await wait(1000);
			await interaction.editReply("Bar!");
			for(var i = 0; i < 3; i++)
			{
				await wait(100);
				await interaction.editReply("bAr!");
				await wait(100);
				await interaction.editReply("baR!");
				await wait(100);
				await interaction.editReply("Bar!");
			}
			const message = await interaction.fetchReply();
			console.log(message);
			interaction.deleteReply();
			interaction.followUp("Done!");
		}
		else if(option == "t2")
		{
			interaction.reply("bar bar :pregnant_man: :pregnant_man: :pregnant_man:");
		}
		else //no option chosen
			interaction.reply("erm what the flip dude");
	},
};
