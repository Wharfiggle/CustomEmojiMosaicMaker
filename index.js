const express = require("express");
const app = express();

app.listen(3000, () => 
{ console.log("Project is running!"); });

app.get("/", (req, res) => 
{ res.send("Hello world!"); });

// Require the necessary discord.js classes
const fs = require("node:fs");
const path = require("node:path");
//this is called object destructuring
//creates a new const variable for each element in the {} and assigns them
//the values of the variables with the same names from the required module (discord.js)
const { Client, Collection, GatewayIntentBits } = require("discord.js");

// Create a new client instance
const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent ] });

client.commands = new Collection();
client.cooldowns = new Collection();

//set up all commands in commands folder
const foldersPath = path.join(__dirname, "commands"); //append "commands" to directory path to get path to commands folder
const commandFolders = fs.readdirSync(foldersPath); //get all folders in commands folder
for(const folder of commandFolders) //iterate through each folder in commands folder
{
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js")); //get all js files in folder
	for(const file of commandFiles)
	{
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if("data" in command && "execute" in command)
			client.commands.set(command.data.name, command);
		else
			//			V backticks, not apostrophes. Can only do string interpolation with backticks
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);

		/*if(command.data.name == "make")
		{
			console.log("printing slash command generated data for use in converting to user install command");
			console.log(JSON.stringify(command.data));
		}*/
	}
}

//set up all events in events folder
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for(const file of eventFiles)
{
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if(event.once)
		client.once(event.name, (...args) => event.execute(...args));
	else
		client.on(event.name, (...args) => event.execute(...args));
}

//manual commands read from new messages created while the bot is active for when slash commands aren't an option
client.on('messageCreate', async (message) =>
{
	const prefix = "cemm ";
	if(message.content.toLowerCase().startsWith(prefix)) //manual commands must start with prefix
	{
		//if there is a space in the message, the end of the command string is the index of the space.
		//otherwise the command string is the rest of the string
		const commandEndIndex = message.content.indexOf(" ", prefix.length);
		const command = message.content.substring(prefix.length, (commandEndIndex == -1) ? undefined : commandEndIndex).toLowerCase();

		try
		{
			console.log(`Command \"${command}\" manually called by user \"${message.author.username}\" (user id: ${message.author})`);

			if(command == "ping")
				await message.reply("Pong!");
			else if(command == "make")
			{
				const make = client.commands.get("make");
				await make.executeManual(message, commandEndIndex);
			}
			else
				await message.reply("Command not recognized. Please make sure you type a space after the command before entering any parameters.");
		}
		catch(error)
		{
			console.error(error);
			await message.reply({ content: "There was an error while executing this command!", ephemeral: true });
		}
	}
});

// Log in to Discord with your client's token
const { token } = require("./config.json");
client.login(token);
