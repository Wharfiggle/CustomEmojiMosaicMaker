const Color = require("color");
const { AttachmentBuilder, SlashCommandBuilder, Colors } = require("discord.js");
const emojiRegex = require("emoji-regex");
const emojiUnicode = require("emoji-unicode")
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const poissonDiscSampler = require("poisson-disc-sampler");

function drawImageRotated(context, image, x, y, width, height, degrees, scale)
{
	const radians = Math.PI * degrees / 180;
	x = scale * x;
	y = scale * y;
	width = scale * width;
	height = scale * height;

	context.save(); //save current state of canvas
	//rotate around image's center
	context.translate(width / 2, height / 2);
	context.rotate(radians);
	context.translate(-width / 2, -height / 2);
	//draw image with position rotated to compensate for context rotation
	const pos = [x * Math.cos(-radians) - y * Math.sin(-radians), y * Math.cos(-radians) + x * Math.sin(-radians)];
	context.drawImage(image, pos[0], pos[1], width, height);
	context.restore(); //restore canvas back to normal
}

let tintctx;
function tintImage(image, color, tintOpacity = 0.5)
{
	if(!tintctx)
		tintctx = createCanvas(image.width, image.height).getContext("2d");
	else
	{
		tintctx.canvas.width = image.width;
		tintctx.canvas.height = image.height;
	}
	tintctx.save();
	//fill canvas with color[0] at opacity of tintOpacity
	tintctx.fillStyle = color[0];
	tintctx.globalAlpha = tintOpacity;
	tintctx.fillRect(0, 0, tintctx.canvas.width, tintctx.canvas.height);
	//draw image at opacity of color[1] and combines with canvas color
	tintctx.globalCompositeOperation = "destination-atop";
	tintctx.globalAlpha = color[1];
	tintctx.drawImage(image, 0, 0);
	tintctx.restore();
	return tintctx.canvas;
}

function getImageAverageColor(image, sampleRadius)
{
	if(!tintctx)
		tintctx = createCanvas(image.width, image.height).getContext("2d");
	else
	{
		tintctx.canvas.width = image.width;
		tintctx.canvas.height = image.height;
	}

	tintctx.save();
	tintctx.drawImage(image, 0, 0);
	
	var samples = [];
	const sampler = poissonDiscSampler(image.width, image.height, sampleRadius);
	var sample;
	while(sample = sampler())
	{
		sample = [Math.round(sample[0]), Math.floor(sample[1])];
		if(sample[0] < 0 || sample[0] >= image.width - 1 || sample[1] < 0 || sample[1] >= image.height - 1)
			continue;
		samples.push(sample);
		//console.log(sample[0] + " ! " + sample[1])
	}

	var r = 0, g = 0, b = 0
	for(var s of samples)
	{
		imageData = tintctx.getImageData(s[0], s[1], 1, 1);
		r += imageData.data[0];
		g += imageData.data[1];
		b += imageData.data[2];
	}
	tintctx.restore();
	return [r / samples.length, g / samples.length, b / samples.length];
}

//returns array where element 0 is the hex code for the color and element 1 is the opacity from 0 to 1
function rgba(r, g, b, a)
{ return [Color.rgb(r, g, b).hex(), a / 255]; }

function rgb(r, g, b)
{ return rgba(r, g, b, 255); }

/*function shuffle(array)
{
	var counter = array.length;
	while(counter > 0)
	{
		const rn = Math.floor(Math.random() * counter);
		counter--;
		const temp = array[counter];
		array[counter] = array[rn];
		array[rn] = temp;
	}
	return array;
}*/

module.exports = 
{
	publicCommand: true,
	cooldown: 10,
	data: new SlashCommandBuilder().setName("make").setDescription("Makes a mosaic of the specified image given a list of emojis.")
		.addAttachmentOption(option =>
			option.setName("image")
				.setDescription("The image to make a mosaic of.")
				.setRequired(true))
		.addStringOption(option =>
			option.setName("emojis")
				.setDescription("The non-gif emojis to use in the mosaic.")
				.setRequired(true)),
	async execute(interaction)
	{
		//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//customizable for best results
		const sampleRadius = 8; //performance is better with larger radius
		const colorSampleSize = 3; //performance is better with smaller sample size
		const emojiSize = 30; //performance is better with smaller emoji size
		const tintStrength = 0;
		const minImageResolution = 1000; //performance is better with lower resolution
		const maxImageResolution = 2000;
		const minOutputResolution = 500;
		const maxOutputResolution = 2000;
		const emojiSampleRadius = 30; //should be an amount that results in single digit samples
		//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		
		//parse emojis
		
		const emojiString = interaction.options.getString("emojis");
		
		var emojis = []; //array of actual emojis
		var emojiImages = []; //array of emoji pngs
		var emojiAvgColors = []; //array of average colors for each emoji
		
		//regex to find all custom emojis
		//regex literals are enclosed between / and / followed by flag characters
		//the g flag makes the regex global, so it will find all matches instead of just the first match
		const customEmojis = [...emojiString.matchAll(/(?<=:)\d+(?=>)/g)];
		for(var e of customEmojis)
		{
			const id = e.toString();
			const emoji = interaction.client.emojis.cache.get(id);
			if(emoji != undefined)
				emojis.push(emoji);
			var img;
			try
			{ img = await loadImage("https://cdn.discordapp.com/emojis/" + id + ".png"); }
			catch(error)
			{
				await interaction.reply({ content: "Invalid custom emoji.", ephemeral: true });
				return;
			}
			//resize custom emoji to fit standard 72x72 size of other emojis
			if(img.width > img.height)
			{
				const ratio = img.height / img.width;
				img.width = 72;
				img.height = 72 * ratio;
			}
			else
			{
				const ratio = img.width / img.height;
				img.width = 72 * ratio;
				img.height = 72;
			}
			emojiImages.push(img);
			emojiAvgColors.push(getImageAverageColor(img, emojiSampleRadius));
		}
		//regex to find unicode emojis and regional indicator letters
		//the u flag allows the regex to match unicode characters
		//const unicodeEmojis = [...emojiString.matchAll(/\p{Extended_Pictographic}|[🇦-🇿]/gu)];
		const unicodeEmojis = [...emojiString.matchAll(emojiRegex()), ...emojiString.matchAll(/[🇦-🇿]/gu)];
		for(var e of unicodeEmojis)
		{
			emojis.push(e.toString());
			const id = emojiUnicode(e.toString()).replaceAll(/\s/g, "-"); //replace spaces with dashes for valid url
			var img;
			try
			{ img = await loadImage("https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/" + id + ".png"); }
			catch(error)
			{
				try
				{ img = await loadImage("https://twemoji.maxcdn.com/v/latest/72x72/" + id + ".png"); }
				catch(error)
				{
					await interaction.reply({ content: e.toString() + " was not found in the database.", ephemeral: true });
					return;
				}
			}
			emojiImages.push(img);
			emojiAvgColors.push(getImageAverageColor(img, emojiSampleRadius));
		}

		if(emojiImages.length == 0)
		{
			await interaction.reply({ content: "Please enter at least one valid emoji.", ephemeral: true });
			return;
		}

		//draw image

		//resize image to make sure it's between minImageResolution and maxImageResolution
		//if image is resized then, at the end, scale image back between minOutputResolution and maxOutputResolution
		const userImage = interaction.options.getAttachment("image");
		const goalImage = await loadImage(userImage.url);
		if(goalImage.width > goalImage.height) //landscape
		{
			const ratio = goalImage.height / goalImage.width;
			
			if(goalImage.width > maxImageResolution) //scale down landscape
			{
				goalImage.width = maxImageResolution;
				goalImage.height = maxImageResolution * ratio;
				if(userImage.width > maxOutputResolution)
				{
					userImage.width = maxOutputResolution;
					userImage.height = maxOutputResolution * ratio;
				}
			}
			else if(goalImage.width < minImageResolution) //scale up landscape
			{
				goalImage.width = minImageResolution / ratio;
				goalImage.height = minImageResolution;
				if(userImage.width < minOutputResolution)
				{
					userImage.width = minOutputResolution / ratio;
					userImage.height = minOutputResolution;
				}
			}
		}
		else //portrait
		{
			const ratio = goalImage.width / goalImage.height;

			if(goalImage.height > maxImageResolution) //scale down portrait
			{
				goalImage.width = maxImageResolution * ratio;
				goalImage.height = maxImageResolution;
				if(userImage.height > maxOutputResolution)
				{
					userImage.width = maxOutputResolution * ratio;
					userImage.height = maxOutputResolution;
				}
			}
			else if(goalImage.height < minImageResolution) //scale up portrait
			{
				goalImage.width = minImageResolution;
				goalImage.height = minImageResolution / ratio;
				if(userImage.height < minOutputResolution)
				{
					userImage.width = minOutputResolution;
					userImage.height = minOutputResolution / ratio;
				}
			}
		}
		const userImageRatio = userImage.width / goalImage.width;
		const goalImageContext = createCanvas(goalImage.width, goalImage.height).getContext("2d");
		goalImageContext.drawImage(goalImage, 0, 0, goalImage.width, goalImage.height);
		
		await interaction.deferReply();
		
		const canvas = createCanvas(userImage.width, userImage.height); //final image retains original pixel resolution
		const context = canvas.getContext("2d");

		//create random but uniform samples of the image, each point around sampleRadius pixels apart
		var samples = [];
		const sampler = poissonDiscSampler(goalImage.width, goalImage.height, sampleRadius);
		var sample;
		while(sample = sampler())
		{
			sample = [Math.round(sample[0]), Math.round(sample[1])];
			if(sample[0] < 0 || sample[0] >= goalImage.width - 1 || sample[1] < 0 || sample[1] >= goalImage.height - 1)
				continue; //skip sample if out of bounds
			samples.push(sample);
			//console.log(sample[0] + ", " + sample[1]);
		}

		var si = 0;
		for(var s of samples)
		{
			//get the average color of the area of size colorSampleSize around the sample
			imageData = goalImageContext.getImageData(
				Math.round(s[0] - colorSampleSize / 2), 
				Math.round(s[1] - colorSampleSize / 2), 
				colorSampleSize, colorSampleSize);
			var r = 0, g = 0, b = 0, a = 0;
			for(var i = 0; i < imageData.data.length; i += 4)
			{
				r += imageData.data[i];
				g += imageData.data[i + 1];
				b += imageData.data[i + 2];
				a += imageData.data[i + 3];
			}
			const dataSize = imageData.data.length / 4;
			r /= dataSize;
			g /= dataSize;
			b /= dataSize;
			a /= dataSize;
			const sampleColor = rgba(r, g, b, a);

			//random index of emoji to use
			const rn = Math.floor(Math.random() * emojiImages.length);
			//tint gets stronger the closer sampleColor is to white or black
			const emojiColorDif = Math.abs((r - emojiAvgColors[rn][0] + g - emojiAvgColors[rn][1] + b - emojiAvgColors[rn][2])) / 255;
			const valueIntensity = Math.abs((r - 127.5 + g - 127.5 + b - 127.5)) / 127.5;
			var tint = tintStrength + (1 - tintStrength) * (emojiColorDif * 3/4 + valueIntensity * 1/4);
			//draw emoji with random rotation at sample location with sampleColor as tint
			const emojiImage = tintImage(emojiImages[rn], sampleColor, tint);
			drawImageRotated(context, emojiImage, s[0] - emojiSize / 2, s[1] - emojiSize / 2, emojiSize, emojiSize, Math.random() * 360, userImageRatio);
			si++;
			//console.log(si + " / " + samples.length);
		}
		
		/*emojiImages = shuffle(emojiImages);
		for(var i = 0; i < emojiImages.length; i++)
		{
			const img = emojiImages[i];
			const pos = [72 * i + goalImage.width / 2, goalImage.height / 2];
			drawImageRotated(context, tintImage(img, rgba(255, 255, 255, 255)), pos[0], pos[1], 72, 72, 0);
		}*/

		// Use the helpful Attachment class structure to process the file for you
		const attachment = new AttachmentBuilder(await canvas.encode("png"), { name: "cool-image.png" });

		await interaction.editReply({ files: [attachment] });
	},
};
