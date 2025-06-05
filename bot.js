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

function isSafeImage(url) {
  try {
    const parsed = new URL(url);
    const domainOk = allowedDomains.some(domain => parsed.hostname.includes(domain));
    const extOk = /\.(jpg|jpeg|png)$/i.test(parsed.pathname);
    return url.startsWith("https://") && domainOk && extOk;
  } catch {
    return false;
  }
}

const sportEmojis = {
  soccer: '⚽',
  basketball: '🏀',
  boxing: '🥊',
  mma: '🛡️',
  volleyball: '🏐',
  badminton: '🏸',
  "table tennis": '🏓',
  hockey: '🏒',
  cycling: '🚴'
};

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: `You're a Gen Z sports columnist. Write a short, engaging sports article on a trending ${sport} match in Europe or Asia.
Include:
- 1-line highlight
- **Strategy:** short tactical breakdown
- **Prediction:** confident or cheeky prediction
Make it fun. Use sport terms. No intro or closing.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 500
  });

  const rawText = completion.choices[0].message.content.trim();
  const imagePromptMatch = rawText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = imagePromptMatch ? imagePromptMatch[1].trim() : `${sport} match in Asia or Europe`;

  const cleanedText = rawText.replace(/(^|\n)Image prompt:.*(\n|$)/gi, "").trim();

  const titleMatch = cleanedText.match(/^(#+\s*)(.*)/);
  const rawTitle = titleMatch ? titleMatch[2].trim() : `${sport.toUpperCase()} UPDATE`;
  const emoji = sportEmojis[sport] || '🏟️';
  const articleTitle = `🏟️ **${rawTitle.toUpperCase()}**`;

  const content = cleanedText
    .replace(/^(#+\s*)/gm, "")
    .replace(/\bStrategy\b:/gi, "**Strategy:**")
    .replace(/\bPrediction\b:/gi, "**Prediction:**")
    .trim();

  const contentWithEmoji = `${emoji} ${content}`;

  return { sport, articleTitle, content: contentWithEmoji, imagePrompt };
}

async function fetchImage(prompt, sport) {
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
      if (isSafeImage(url)) return url;
    }
  } catch (err) {
    console.warn("⚠️ Image search failed:", err.message);
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
      if (!channel?.isTextBased()) throw new Error("Invalid channel");

      const imageEmbed = new EmbedBuilder()
        .setImage(image)
        .setColor(0x00bfff);

      const contentEmbed = new EmbedBuilder()
        .setDescription(`${articleTitle}\n\n${content}\n\n${hashtags}\n\n@everyone`)
        .setColor(0xff4500)
        .setFooter({ text: footer })
        .setTimestamp();

      await channel.send({ embeds: [imageEmbed] });
      await channel.send({ embeds: [contentEmbed] });

      console.log(`✅ ${sport} column posted`);
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
    const image = await fetchImage(result.imagePrompt, result.sport);
    await postToDiscord({ ...result, image });
  } catch (err) {
    console.error("❌ Bot error:", err.message);
  }
})();
