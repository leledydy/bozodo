import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const sportEmojis = {
  football: "🏈",
  basketball: "🏀",
  tennis: "🎾",
  boxing: "🥊",
  baseball: "⚾",
  golf: "⛳",
  hockey: "🏒",
  MMA: "🤼",
  "Formula 1": "🏎️",
  cricket: "🏏",
  rugby: "🏉",
  cycling: "🚴",
  esports: "🎮"
};

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);
  const today = new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  console.log(`🎯 Generating column for: ${sport}`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: `You are a professional sports columnist. Today is ${today}. You're writing a timely, passionate, and witty article for Discord.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 600
  });

  const fullText = completion.choices[0].message.content.trim();
  const match = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = match ? match[1].trim() : `A dramatic ${sport} scene`;
  const article = fullText.replace(/Image prompt:.*/i, "").trim();

  return {
    sport,
    content: article,
    imagePrompt
  };
}

async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024"
  });

  return response.data[0].url;
}

async function postToDiscord({ sport, content, imageUrl }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const emoji = sportEmojis[sport] || "🏟️";
  const formattedSport = sport.charAt(0).toUpperCase() + sport.slice(1);

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${formattedSport} Daily Update`)
    .setDescription(content.trim().replace(/\n{2,}/g, '\n\n'))
    .setColor(0x1e90ff)
    .setImage(imageUrl)
    .setFooter({ text: "🖋️ Written by bozodo" })
    .setTimestamp();

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");

      await channel.send({ embeds: [embed] });
      console.log(`✅ Posted ${formattedSport} column to Discord.`);
      client.destroy();
    } catch (err) {
      console.error("❌ Discord post error:", err.message);
      client.destroy();
    }
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

(async () => {
  try {
    const result = await generateColumn();
    const imageUrl = await generateImage(result.imagePrompt);
    await postToDiscord({ ...result, imageUrl });
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
