import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt, generateHashtags } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fallbackImages = {
  soccer: "https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e",
  mma: "https://images.unsplash.com/photo-1604112900927-e4c3f37b9c13",
  basketball: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d",
  volleyball: "https://images.unsplash.com/photo-1599058917212-d750089bc1e2",
  "table tennis": "https://images.unsplash.com/photo-1618886614638-37fe80e40d9f",
  badminton: "https://images.unsplash.com/photo-1611270629569-1ec7c99a6260",
  boxing: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
  cycling: "https://images.unsplash.com/photo-1507499739999-097706ad8914",
  hockey: "https://images.unsplash.com/photo-1605460375648-278bcbd579a6",
  default: "https://images.unsplash.com/photo-1547347298-4074fc3086f0"
};

const keywords = [
  "player", "match", "stadium", "court", "field", "arena", "fight", "race",
  "game", "goal", "team", "coach", "championship", "tournament", "training",
  "soccer", "boxing", "basketball", "badminton", "hockey", "cycling", "volleyball", "mma"
];

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: `You're a Gen Z sports columnist. Write a very short, punchy ${sport} article for today in Europe or Asia.
Summarize news in 1–2 lines. Clearly mark **Strategy** and **Prediction** sections. Do NOT include any 'Image prompt'.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 500
  });

  const fullText = completion.choices[0].message.content.trim();
  const titleMatch = fullText.match(/^(#+\s*)(.*)/);
  const articleTitle = titleMatch ? titleMatch[2].trim() : `${sport.toUpperCase()} Today`;

  const cleanedText = fullText
    .replace(/(^|\n)Image prompt:.*(\n|$)/gi, "")
    .replace(/^(#+\s*)/gm, "")
    .replace(/\bStrategy\b:/gi, "**Strategy:**")
    .replace(/\bPrediction\b:/gi, "**Prediction:**")
    .trim();

  return {
    sport,
    articleTitle,
    content: cleanedText,
    imagePrompt: `${sport} player or stadium in Europe or Asia`
  };
}

async function fetchImages(prompt, sport, maxImages = 1) {
  const images = [];

  async function isValid(url) {
    try {
      const parsed = new URL(url);
      const isImage = /\.(jpg|jpeg|png)$/i.test(parsed.pathname);
      const containsKeyword = keywords.some(k => url.toLowerCase().includes(k)) || url.toLowerCase().includes(sport);
      if (!url.startsWith("https://") || !isImage || !containsKeyword) return false;

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
      const width = img.width || 1600;
      const height = img.height || 900;
      const ratio = width / height;
      if (ratio < 1.6 || ratio > 1.8) continue;

      if (await isValid(url)) {
        images.push(url);
        if (images.length >= maxImages) break;
      }
    }
  } catch (e) {
    console.warn("⚠️ Serper image search failed:", e.message);
  }

  if (images.length === 0) {
    const fallback = fallbackImages[sport] || fallbackImages.default;
    images.push(fallback);
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

      // Send title text first
      await channel.send({ content: topTitle });

      // Then send the embed with image and content
      const embed = new EmbedBuilder()
        .setImage(images[0])
        .setTitle(articleTitle.toUpperCase())
        .setDescription(`${content}\n\n${hashtags}\n\n@everyone`)
        .setColor(0xff4500)
        .setFooter({ text: footer })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

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
