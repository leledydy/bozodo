import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt, generateHashtags } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Imgur-hosted fallbacks for Discord-safe embeds
const fallbackImages = {
  football: "https://i.imgur.com/fILe7St.jpg",
  basketball: "https://i.imgur.com/UW5sZGt.jpg",
  tennis: "https://i.imgur.com/RLu4Jts.jpg",
  mma: "https://i.imgur.com/NXv4TDb.jpg",
  esports: "https://i.imgur.com/FuljWxj.jpg",
  cricket: "https://i.imgur.com/Avu4afA.jpg",
  rugby: "https://i.imgur.com/kvM0ZzH.jpg",
  baseball: "https://i.imgur.com/CEfzvG4.jpg",
  golf: "https://i.imgur.com/l9Z6ZwF.jpg",
  cycling: "https://i.imgur.com/lhTlp4Z.jpg",
  default: "https://i.imgur.com/2l7wKne.jpg"
};

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  console.log(`🎯 Generating column for: ${sport}`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: `You're a Gen Z–friendly sports columnist. Today is ${today}. Write a fun and insightful sports column about a trending ${sport} match or event. Include a bold article title, highlight moments, key strategies, prediction, and a short image prompt.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 700
  });

  const fullText = completion.choices[0].message.content.trim();

  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} athlete action photo`;

  const titleMatch = fullText.match(/^(#+\s*)(.*)/);
  const articleTitle = titleMatch ? titleMatch[2].trim() : `${sport} Spotlight`;

  const content = fullText
    .replace(/Image prompt:.*/i, "")
    .replace(/^(#+\s*)/gm, "")
    .trim();

  return { sport, articleTitle, content, imagePrompt };
}

async function fetchImages(prompt, sport, maxImages = 1) {
  const images = [];

  function isValid(url) {
    try {
      const parsed = new URL(url);
      return url.startsWith("https://") &&
        /\.(jpg|jpeg|png)(\?.*)?$/.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  async function validateUrl(url) {
    try {
      const res = await axios.head(url);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  try {
    const res = await axios.post('https://google.serper.dev/images', { q: prompt }, {
      headers: {
        'X-API-KEY': process.env.SERPAPI_KEY,
        'Content-Type': 'application/json'
      }
    });

    const found = res.data.images || [];
    for (const img of found) {
      const url = img.imageUrl || img.image;
      if (isValid(url) && await validateUrl(url)) {
        images.push(url);
        if (images.length >= maxImages) break;
      }
    }
  } catch (e) {
    console.warn("⚠️ Serper fetch failed:", e.message);
  }

  if (images.length === 0) {
    const fallback = fallbackImages[sport.toLowerCase()] || fallbackImages.default;
    images.push(fallback);
    console.log("🧊 Fallback image used:", fallback);
  }

  return images;
}

async function postToDiscord({ sport, articleTitle, content, images }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

  const topTitle = `🏆 ${sport.toUpperCase()} UPDATE`;
  const hashtags = generateHashtags(sport);
  const footer = `🖋️ Written by bozodo`;

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");

      await channel.send({ content: topTitle });

      const imageEmbed = new EmbedBuilder()
        .setImage(images[0])
        .setColor(0x00bfff);
      await channel.send({ embeds: [imageEmbed] });

      const contentEmbed = new EmbedBuilder()
        .setDescription(`**${articleTitle}**\n\n${content}\n\n${hashtags}`)
        .setColor(0xff4500)
        .setFooter({ text: footer })
        .setTimestamp();

      await channel.send({ embeds: [contentEmbed] });

      console.log(`✅ ${sport} column posted.`);
    } catch (err) {
      console.error("❌ Discord post error:", err.message);
    } finally {
      client.destroy();
    }
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

// MAIN
(async () => {
  try {
    const result = await generateColumn();
    const images = await fetchImages(result.imagePrompt, result.sport);
    await postToDiscord({ ...result, images });
  } catch (err) {
    console.error("❌ Bot failed:", err.message);
  }
})();
