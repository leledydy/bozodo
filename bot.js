import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fallbackImages = {
  football: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Football_in_Bloomington.jpg",
  basketball: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Basketball.png",
  tennis: "https://upload.wikimedia.org/wikipedia/commons/4/42/Tennis_Racket_and_Balls.jpg",
  mma: "https://upload.wikimedia.org/wikipedia/commons/4/4f/UFC_MMA_Fight.jpg",
  esports: "https://upload.wikimedia.org/wikipedia/commons/4/4d/ESL_One_Cologne_2018.jpg",
  cycling: "https://upload.wikimedia.org/wikipedia/commons/d/d1/Tour_de_France_2015.jpg"
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
        content: `You're a Gen Z–friendly sports columnist. Today is ${today}. Write a fun and informative post about a ${sport} event with strategy, highlight, data, prediction, and a cool closing image prompt.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 700
  });

  const fullText = completion.choices[0].message.content.trim();
  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} athlete action photo`;
  const content = fullText.replace(/Image prompt:.*/i, "").trim();

  return { sport, content, imagePrompt };
}

async function fetchImages(prompt, sport, maxImages = 1) {
  const images = [];
  const trustedDomains = [
    'cdn.pixabay.com', 'static01.nyt.com', 'cdn.espn.com',
    'media.gettyimages.com', 'upload.wikimedia.org'
  ];

  function isValid(url) {
    try {
      const parsed = new URL(url);
      return url.startsWith("https://") &&
        /\.(jpg|jpeg|png)(\?.*)?$/.test(parsed.pathname) &&
        trustedDomains.includes(parsed.hostname);
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
        console.log(`✅ Found image: ${url}`);
        if (images.length >= maxImages) break;
      }
    }
  } catch (e) {
    console.warn("⚠️ Serper fetch failed:", e.message);
  }

  // Fallback
  if (images.length === 0) {
    const fallback = fallbackImages[sport.toLowerCase()] ||
      "https://cdn.pixabay.com/photo/2016/03/27/22/22/stadium-1283674_1280.jpg";
    images.push(fallback);
    console.log("🧊 Fallback image used:", fallback);
  }

  return images;
}

async function postToDiscord({ sport, content, images }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const title = `**${sport.toUpperCase()} DAILY UPDATE**`;

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");

      console.log("📨 Posting to Discord...");

      // 1. Image Embed (first)
      const imageUrl = images[0];
      if (imageUrl) {
        console.log("🖼️ Posting image:", imageUrl);
        const imageEmbed = new EmbedBuilder()
          .setImage(imageUrl)
          .setColor(0x00bfff);
        await channel.send({ embeds: [imageEmbed] });
      }

      // 2. Bold title below image
      const titleEmbed = new EmbedBuilder()
        .setDescription(title)
        .setColor(0xff6600);
      await channel.send({ embeds: [titleEmbed] });

      // 3. Main article
      const contentEmbed = new EmbedBuilder()
        .setDescription(content.slice(0, 4000))
        .setColor(0xff4500)
        .setFooter({ text: "🖋️ Written by bozodo" })
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
