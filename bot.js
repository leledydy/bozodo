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

const allowedDomains = ["upload.wikimedia.org", "images.unsplash.com"];

function isSafeImage(url, sport) {
  try {
    const parsed = new URL(url);
    const domainOk = allowedDomains.some(domain => parsed.hostname.includes(domain));
    const extOk = /\.(jpg|jpeg|png)$/i.test(parsed.pathname);
    const sportMatch = url.toLowerCase().includes(sport);
    return url.startsWith("https://") && domainOk && extOk && sportMatch;
  } catch {
    return false;
  }
}

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: `You're a Gen Z sports columnist. Write a short and sharp update about a trending ${sport} match in Europe or Asia.
Include:
- A short news summary (1–2 lines)
- **Strategy:** A brief tactical insight
- **Prediction:** A confident or witty forecast
Make it exciting and brief. No intro or closing.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 500
  });

  const fullText = completion.choices[0].message.content.trim();
  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} stadium in Asia or Europe`;

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

async function fetchTrustedImage(prompt, sport) {
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
      if (isSafeImage(url, sport)) return url;
    }
  } catch (err) {
    console.warn("⚠️ Serper error:", err.message);
  }

  return fallbackImages[sport] || fallbackImages.default;
}

async function postToDiscord({ sport, articleTitle, content, image }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const hashtags = generateHashtags(sport);
  const footer = `🖋️ Written by bozodo`;

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel?.isTextBased()) throw new Error("Invalid Discord channel");

      await channel.send({ content: `@everyone\n🏆 ${sport.toUpperCase()} UPDATE` });

      const imageEmbed = new EmbedBuilder()
        .setImage(image)
        .setColor(0x00bfff);
      await channel.send({ embeds: [imageEmbed] });

      const contentEmbed = new EmbedBuilder()
        .setDescription(`**${articleTitle}**\n\n${content}\n\n${hashtags}`)
        .setColor(0xff4500)
        .setFooter({ text: footer })
        .setTimestamp();
      await channel.send({ embeds: [contentEmbed] });

      console.log(`✅ ${sport} posted with image`);
    } catch (err) {
      console.error("❌ Discord error:", err.message);
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
    const image = await fetchTrustedImage(result.imagePrompt, result.sport);
    await postToDiscord({ ...result, image });
  } catch (err) {
    console.error("❌ Bot error:", err.message);
  }
})();
