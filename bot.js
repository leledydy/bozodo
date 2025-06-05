import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt, generateHashtags } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fallbackImages = {
  soccer: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Football_match.jpg",
  mma: "https://upload.wikimedia.org/wikipedia/commons/9/9e/UFC_Octagon.jpg",
  basketball: "https://upload.wikimedia.org/wikipedia/commons/8/89/Basketball_game.jpg",
  volleyball: "https://upload.wikimedia.org/wikipedia/commons/b/bf/Volleyball_2012.jpg",
  "table tennis": "https://upload.wikimedia.org/wikipedia/commons/1/1c/Table_tennis_table.jpg",
  badminton: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Badminton_2012.jpg",
  boxing: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Boxing_ring.jpg",
  cycling: "https://upload.wikimedia.org/wikipedia/commons/6/67/Velodrome_cycling.jpg",
  hockey: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Ice_hockey_game.jpg",
  default: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Sport_collage.jpg"
};

const allowedDomains = ["wikimedia.org", "unsplash.com"];
const keywords = [
  "player", "match", "stadium", "court", "field", "arena", "fight", "race", "goal",
  "team", "coach", "championship", "training", "soccer", "boxing", "basketball",
  "badminton", "hockey", "cycling", "volleyball", "mma"
];

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: `You're a Gen Z sports columnist. Write a short, sharp update about a trending ${sport} match in Europe or Asia.
Include:
- 1-line news summary
- **Strategy:** 1-line tactic
- **Prediction:** 1-line confident forecast
Make it exciting.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 500
  });

  const fullText = completion.choices[0].message.content.trim();
  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} player or stadium photo in Asia or Europe`;

  const titleMatch = fullText.match(/^(#+\s*)(.*)/);
  const articleTitle = titleMatch ? titleMatch[2].trim() : `${sport.toUpperCase()} Today`;

  const content = fullText
    .replace(/(^|\n)Image prompt:.*(\n|$)/i, "")
    .replace(/^(#+\s*)/gm, "")
    .replace(/\bStrategy\b:/gi, "**Strategy:**")
    .replace(/\bPrediction\b:/gi, "**Prediction:**")
    .trim();

  return { sport, articleTitle, content, imagePrompt };
}

async function fetchImages(prompt, sport, maxImages = 1) {
  const images = [];

  async function isValid(url) {
    try {
      const parsed = new URL(url);
      const isTrusted = allowedDomains.some(domain => parsed.hostname.includes(domain));
      const isImage = /\.(jpg|jpeg|png)$/i.test(parsed.pathname);
      const keywordMatch = keywords.some(k => url.toLowerCase().includes(k)) || url.toLowerCase().includes(sport);
      if (!url.startsWith("https://") || !isTrusted || !isImage || !keywordMatch) return false;

      const res = await axios.head(url);
      return res.status === 200 && res.headers['content-type'].startsWith("image/");
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

    const results = res.data?.images || [];
    for (const img of results) {
      const url = img.imageUrl || img.image;
      if (await isValid(url)) {
        images.push(url);
        if (images.length >= maxImages) break;
      }
    }
  } catch (err) {
    console.warn("⚠️ Serper image search failed:", err.message);
  }

  if (images.length === 0) {
    const fallback = fallbackImages[sport] || fallbackImages.default;
    images.push(fallback);
  }

  return images;
}

async function postToDiscord({ sport, articleTitle, content, images }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const hashtags = generateHashtags(sport);
  const footer = `🖋️ Written by bozodo`;

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel?.isTextBased()) throw new Error("Invalid channel");

      await channel.send({ content: `@everyone\n🏆 ${sport.toUpperCase()} UPDATE` });

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

      console.log(`✅ ${sport} column posted with image.`);
    } catch (err) {
      console.error("❌ Discord post failed:", err.message);
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
    console.error("❌ Bot error:", err.message);
  }
})();
