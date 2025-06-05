import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt, generateHashtags } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fallbackImages = {
  soccer: "https://i.imgur.com/kXjXmD5.jpg",
  mma: "https://i.imgur.com/NXv4TDb.jpg",
  basketball: "https://i.imgur.com/UW5sZGt.jpg",
  volleyball: "https://i.imgur.com/rsHSEH7.jpg",
  "table tennis": "https://i.imgur.com/J0vKhyo.jpg",
  badminton: "https://i.imgur.com/BXJb9vE.jpg",
  boxing: "https://i.imgur.com/9sUGTfD.jpg",
  cycling: "https://i.imgur.com/lhTlp4Z.jpg",
  hockey: "https://i.imgur.com/GM4QZbZ.jpg",
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
        content: `You're a Gen Z–style sports writer. Today is ${today}. You write hot takes and predictions on current ${sport} matches in Europe or Asia. Keep it short, bold, and witty.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 650
  });

  const fullText = completion.choices[0].message.content.trim();

  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} match moment in Europe or Asia`;

  const titleMatch = fullText.match(/^(#+\s*)(.*)/);
  const articleTitle = titleMatch ? titleMatch[2].trim() : `${sport.toUpperCase()} Vibes`;

  const content = fullText
    .replace(/Image prompt:.*/i, "") // 🔥 Removes image prompt from article
    .replace(/^(#+\s*)/gm, "")       // 🔥 Removes heading markdown
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
    const fallback = fallbackImages[sport] || fallbackImages.default;
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
