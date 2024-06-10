//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//applies commands to all servers the bot is in, there's a limit on how often you can use it so be careful
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const readline = require("readline");
main();

function askQuestion(query)
{
	const rl = readline.createInterface( { input: process.stdin, output: process.stdout } );
	return new Promise(resolve => rl.question(query, ans =>
	{
		rl.close();
		resolve(ans);
	}))
}

async function main()
{
	const answer = await askQuestion("Are you sure you want to globally update the commands? (y/n): ");
	if(answer != "y") //if answer isn't y or Y, do not run the rest of the program
		return;
	
	const { REST, Routes } = require('discord.js');
	const fs = require('node:fs');
	const path = require('node:path');
	const { exit } = require('node:process');
	const { token, clientid } = require("./config.json");
	
	const commands = [];
	// Grab all the command folders from the commands directory you created earlier
	const foldersPath = path.join(__dirname, 'commands');
	const commandFolders = fs.readdirSync(foldersPath);
	
	for(const folder of commandFolders)
	{
		// Grab all the command files from the commands directory you created earlier
		const commandsPath = path.join(foldersPath, folder);
		const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
		// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
		for(const file of commandFiles) 
		{
			const filePath = path.join(commandsPath, file);
			const command = require(filePath);
			if('data' in command && 'execute' in command)
			{
				//only push commands that have the globalCommand property set to true
				if("publicCommand" in command && command.publicCommand == true)
					commands.push(command.data.toJSON());
			}
			else
				console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
	
	// Construct and prepare an instance of the REST module
	const rest = new REST().setToken(token);
	
	// and deploy your commands!
	(async () => 
	{
		try
		{
			console.log(`Started refreshing ${commands.length} application (/) commands.`);
	
			// The put method is used to fully refresh all commands in the guild with the current set
			const data = await rest.put(
				Routes.applicationCommands(clientid),
				{ body: commands }
			);
	
			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} 
		catch(error)
		{ // And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
}