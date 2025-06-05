import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt, generateHashtags } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const allowedDomains = ["images.unsplash.com", "cdn.pixabay.com", "media.istockphoto.com"];

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
        content: `You're a Gen Z sports columnist. Write a short and punchy sports article on a trending ${sport} match in Europe or Asia.
Include:
- A one-line highlight
- **Strategy:** a tactical insight
- **Prediction:** bold or cheeky outcome
Use a few emojis. Do not include any "image prompt" line.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 500
  });

  const rawText = completion.choices[0].message.content.trim();
  const cleanedText = rawText.replace(/(^|\n)Image prompt:.*(\n|$)/gi, "").trim();

  const titleMatch = cleanedText.match(/^(#+\s*)(.*)/);
  const rawTitle = titleMatch ? titleMatch[2].trim() : `${sport.toUpperCase()} UPDATE`;
  const emoji = sportEmojis[sport] || '🏟️';
  const articleTitle = `**${emoji} ${rawTitle.toUpperCase()}**`;

  const content = cleanedText
    .replace(/^(#+\s*)/gm, "")
    .replace(/\bStrategy\b:/gi, "**Strategy:**")
    .replace(/\bPrediction\b:/gi, "**Prediction:**")
    .trim();

  return { sport, articleTitle, content };
}

async function fetchImage(sport) {
  try {
    const query = `${sport} match in Asia or Europe`;
    const res = await axios.post('https://google.serper.dev/images', { q: query }, {
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

  return null; // no fallback — keep it clean
}

async function postToDiscord({ sport, articleTitle, content, image }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const hashtags = generateHashtags(sport);
  const footer = `🖋️ Written by bozodo`;

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel?.isTextBased()) throw new Error("Invalid channel");

      const embed = new EmbedBuilder()
        .setTitle(articleTitle)
        .setDescription(`${content}\n\n${hashtags}\n\n@everyone`)
        .setColor(0xff4500)
        .setFooter({ text: footer })
        .setTimestamp();

      if (image) {
        embed.setImage(image);
      }

      await channel.send({ embeds: [embed] });
      console.log(`✅ ${sport} article posted to Discord`);
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
    const image = await fetchImage(result.sport);
    await postToDiscord({ ...result, image });
  } catch (err) {
    console.error("❌ Bot error:", err.message);
  }
})();
