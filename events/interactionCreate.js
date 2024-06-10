const { Events, Collection } = require("discord.js");

module.exports = 
{
	name: Events.InteractionCreate,
	async execute(interaction) 
	{
		if(!interaction.isChatInputCommand())
			return;

		const command = interaction.client.commands.get(interaction.commandName);

		if(!command)
		{
			console.error("No command matching ${interaction.commandName} was found.");
			return;
		}

		//cooldowns
		
		const { cooldowns } = interaction.client;

		if(!cooldowns.has(command.data.name))
			cooldowns.set(command.data.name, new Collection());

		const now = Date.now();
		const timestamps = cooldowns.get(command.data.name);
		//if command.cooldown is valid, use that, otherwise default to 3 seconds
		//" * 1_000" converts to milliseconds for straightforward calculation
		const cooldownAmount = (command.cooldown ?? 3) * 1000;

		if(timestamps.has(interaction.user.id))
		{
			//get time of last executed command and add cooldown amount to it
			const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

			if(now < expirationTime) //cooldown has not expired yet, print error and return
			{
				const expiredTimestamp = Math.round(expirationTime / 1000);
				//backticks, not apostrophes. Can only do string interpolation with backticks V
				return interaction.reply({ content: `Please wait, you are on a cooldown for \'`
					//					ephemeral means only the user who sent the command can see this reply V
					//		  shows user how long they have to wait V	"in N seconds" or "N seconds ago"
					+ command.data.name + `\'. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
			}
		}

		//add new timestamp for this executed command and set it to delete after cooldownAmount
		timestamps.set(interaction.user.id, now);
		setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
		
		try
		{
			await command.execute(interaction);
		}
		catch(error)
		{
			console.error(error);
			if(interaction.replied || interaction.deferred)
				await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
			else
				await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
		}
	}
};