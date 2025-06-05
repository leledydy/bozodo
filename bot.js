import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sportEmojis = {
  football: "🏈", basketball: "🏀", tennis: "🎾", boxing: "🥊", baseball: "⚾",
  golf: "⛳", hockey: "🏒", MMA: "🤼", "Formula 1": "🏎️", cricket: "🏏",
  rugby: "🏉", cycling: "🚴", esports: "🎮"
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
        content: `You're a smart, witty, professional sports columnist. Today is ${today}. Write for a Discord audience.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 600
  });

  const fullText = completion.choices[0].message.content.trim();
  const match = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = match ? match[1].trim() : `${sport} stadium or match scene`;
  const article = fullText.replace(/Image prompt:.*/i, "").replace(/^>\s*/gm, "").trim();

  return { sport, content: article, imagePrompt };
}

async function fetchImage(prompt) {
  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: {
        q: prompt,
        tbm: 'isch',
        api_key: process.env.SERPAPI_KEY,
        num: 1
      }
    });

    return res.data.images_results[0]?.original || null;
  } catch (err) {
    console.warn("⚠️ Image fetch failed:", err.message);
    return null;
  }
}

async function postToDiscord({ sport, content, imageUrl }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const emoji = sportEmojis[sport] || "🏟️";
  const title = `🏆 𝗠𝗔𝗝𝗢𝗥 𝗨𝗣𝗗𝗔𝗧𝗘 — ${sport.toUpperCase()} 🏆`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(content)
    .setColor(0xff4500)
    .setImage(imageUrl || "https://cdn.pixabay.com/photo/2016/11/18/17/20/football-1834432_1280.jpg")
    .setFooter({ text: "🖋️ Written by bozodo" })
    .setTimestamp();

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");
      await channel.send({ embeds: [embed] });
      console.log(`✅ Posted ${sport} update.`);
    } catch (err) {
      console.error("❌ Discord post error:", err.message);
    } finally {
      client.destroy();
    }
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

(async () => {
  try {
    const result = await generateColumn();
    const imageUrl = await fetchImage(result.imagePrompt);
    await postToDiscord({ ...result, imageUrl });
  } catch (err) {
    console.error("❌ Bot error:", err.message);
  }
})();
