import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fallbackImages = {
  football: "https://cdn.pixabay.com/photo/2016/11/18/17/20/football-1834432_1280.jpg",
  basketball: "https://cdn.pixabay.com/photo/2017/03/26/22/14/basketball-2178703_1280.jpg",
  tennis: "https://cdn.pixabay.com/photo/2014/08/15/06/21/tennis-418837_1280.jpg"
};

const sportEmojis = {
  football: "🏈", basketball: "🏀", tennis: "🎾", boxing: "🥊", baseball: "⚾",
  golf: "⛳", hockey: "🏒", MMA: "🤼", "Formula 1": "🏎️", cricket: "🏏",
  rugby: "🏉", cycling: "🚴", esports: "🎮"
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
        content: `You're a fun, Gen Z–friendly sports columnist. Today is ${today}. Include real teams or players. Write with slang and strategy. End with "Image prompt: ..." to describe visuals.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 700
  });

  const fullText = completion.choices[0].message.content.trim();
  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} action photo`;
  const content = fullText.replace(/Image prompt:.*/i, "").trim();

  return { sport, content, imagePrompt };
}

async function fetchImages(prompt, sport, maxImages = 2) {
  const images = [];
  const trustedDomains = [
    'cdn.pixabay.com',
    'static01.nyt.com',
    'cdn.espn.com',
    'img.bleacherreport.net',
    'media.gettyimages.com',
    'upload.wikimedia.org'
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

  async function trySource(apiName, results) {
    for (const img of results) {
      const url = img.imageUrl || img.image;
      if (!isValid(url)) continue;
      if (await validateUrl(url)) {
        images.push(url);
        console.log(`✅ Valid image from ${apiName}:`, url);
        if (images.length >= maxImages) break;
      }
    }
  }

  try {
    const res = await axios.post('https://google.serper.dev/images', { q: prompt }, {
      headers: {
        'X-API-KEY': process.env.SERPAPI_KEY,
        'Content-Type': 'application/json'
      }
    });
    await trySource('Serper', res.data.images || []);
  } catch (e) {
    console.warn("❌ Serper error:", e.message);
  }

  if (images.length === 0 && fallbackImages[sport]) {
    images.push(fallbackImages[sport]);
    console.log("🧊 Using fallback image.");
  }

  return images;
}

async function postToDiscord({ sport, content, images }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const emoji = sportEmojis[sport] || "🏟️";
  const title = `🏆 **${sport.toUpperCase()} DAILY UPDATE** 🏆`;

  const imageEmbed = images[0]
    ? new EmbedBuilder().setImage(images[0]).setColor(0xff8800)
    : null;

  const contentEmbed = new EmbedBuilder()
    .setDescription(content.slice(0, 4000))
    .setColor(0xff4500)
    .setFooter({ text: "🖋️ Written by bozodo" })
    .setTimestamp();

  const extraImageEmbeds = (images.slice(1)).map(url =>
    new EmbedBuilder().setImage(url).setColor(0xcccccc)
  );

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");

      // 1. Title
      await channel.send({ content: title });

      // 2. Main image (if any)
      if (imageEmbed) await channel.send({ embeds: [imageEmbed] });

      // 3. Article content
      await channel.send({ embeds: [contentEmbed] });

      // 4. Extra images (if any)
      for (const embed of extraImageEmbeds) {
        await channel.send({ embeds: [embed] });
      }

      console.log(`✅ Posted ${sport} update.`);
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
