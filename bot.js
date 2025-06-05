import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
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
  const article = fullText.replace(/Image prompt:.*/i, "").trim();

  return { sport, content: article, imagePrompt };
}

async function fetchImage(prompt) {
  // 1. Try Serper API
  try {
    const serperRes = await axios.post('https://google.serper.dev/images', {
      q: prompt
    }, {
      headers: {
        'X-API-KEY': process.env.SERPAPI_KEY,
        'Content-Type': 'application/json'
      }
    });

    const validImage = serperRes.data.images?.find(img =>
      img.imageUrl?.startsWith('https://') &&
      (img.imageUrl.endsWith('.jpg') || img.imageUrl.endsWith('.png'))
    );

    if (validImage?.imageUrl) {
      console.log("✅ Using Serper image:", validImage.imageUrl);
      return validImage.imageUrl;
    }
  } catch (err) {
    console.warn("❌ Serper failed:", err.message);
  }

  // 2. Fallback: DuckDuckGo
  try {
    const html = await axios.get('https://duckduckgo.com/', { params: { q: prompt } });
    const tokenMatch = html.data.match(/vqd='(.+?)'/);
    if (!tokenMatch) throw new Error("No VQD token found");

    const vqd = tokenMatch[1];
    const ddgRes = await axios.get('https://duckduckgo.com/i.js', {
      params: {
        q: prompt,
        vqd,
        o: 'json',
        f: '',
        p: '1',
        l: 'us-en'
      },
      headers: {
        'Referer': 'https://duckduckgo.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const validImage = ddgRes.data.results.find(img =>
      img.image?.startsWith('https://') &&
      (img.image.endsWith('.jpg') || img.image.endsWith('.png'))
    );

    if (validImage?.image) {
      console.log("✅ Using DuckDuckGo fallback image:", validImage.image);
      return validImage.image;
    }
  } catch (err) {
    console.warn("⚠️ DuckDuckGo fallback failed:", err.message);
  }

  // 3. Hardcoded static fallback
  const fallback = "https://cdn.pixabay.com/photo/2016/11/18/17/20/football-1834432_1280.jpg";
  console.log("📷 Using final fallback image:", fallback);
  return fallback;
}

async function postToDiscord({ sport, content, imageUrl }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const emoji = sportEmojis[sport] || "🏟️";
  const title = `🏆 𝗠𝗔𝗝𝗢𝗥 𝗨𝗣𝗗𝗔𝗧𝗘 — ${sport.toUpperCase()} 🏆`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(content)
    .setColor(0xff4500)
    .setImage(imageUrl)
    .setFooter({ text: "🖋️ Written by bozodo" })
    .setTimestamp();

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");
      await channel.send({ embeds: [embed] });
      console.log(`✅ Posted ${sport} update to channel.`);
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
    const imageUrl = await fetchImage(result.imagePrompt);
    await postToDiscord({ ...result, imageUrl });
  } catch (err) {
    console.error("❌ Bot failed:", err.message);
  }
})();
