const { SlashCommandBuilder } = require("discord.js");

module.exports =
{
	data: new SlashCommandBuilder().setName("reload").setDescription("Reloads a command.")
		.addStringOption(option =>
			option.setName("command")
				.setDescription("The command to reload.")
				.setRequired(true)),
	async execute(interaction)
	{
		const commandName = interaction.options.getString("command", true).toLowerCase();
		const command = interaction.client.commands.get(commandName);

		if(!command)
			return interaction.reply(`There is no command with name \`${commandName}\`!`);

		//requiring a file will cache it, so requiring it again will load the old cached version.
		//because of this we need to delete the version of the command file in the require cache
		delete require.cache[require.resolve(`./${command.data.name}.js`)];

		try
		{
			//load updated command, overwrite old command in commands collection
			const newCommand = require(`./${command.data.name}.js`);
			interaction.client.commands.set(newCommand.data.name, newCommand);
			await interaction.reply(`Command \`${newCommand.data.name}\` was reloaded!`);
		}
		catch(error)
		{
			console.error(error);
			await interaction.reply(`There was an error while reloading a command \`${command.data.name}\`:\n\`${error.message}\``);
		}
	}
};