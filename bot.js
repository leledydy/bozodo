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

const fallbackImages = {
  football: "https://cdn.pixabay.com/photo/2016/11/18/17/20/football-1834432_1280.jpg",
  basketball: "https://cdn.pixabay.com/photo/2017/03/26/22/14/basketball-2178703_1280.jpg",
  tennis: "https://cdn.pixabay.com/photo/2014/08/15/06/21/tennis-418837_1280.jpg",
  // Add more if needed
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
        content: `You're a witty, professional sports columnist writing for a Discord audience. Today is ${today}. Include real teams or players if applicable. End with "Image prompt: ..." and one real sports news URL.`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 700
  });

  const fullText = completion.choices[0].message.content.trim();
  const imgMatch = fullText.match(/Image prompt:\s*(.+)/i);
  const urlMatch = fullText.match(/https?:\/\/[^\s]+/g);

  const imagePrompt = imgMatch ? imgMatch[1].trim() : `${sport} action shot`;
  const newsUrl = urlMatch ? urlMatch[urlMatch.length - 1] : null;

  const content = fullText
    .replace(/Image prompt:.*/i, "")
    .replace(newsUrl, "")
    .trim();

  return { sport, content, imagePrompt, newsUrl };
}

async function fetchImage(prompt, sport, fallbackUrl = null) {
  // 1. Try Serper API
  try {
    const res = await axios.post('https://google.serper.dev/images', {
      q: prompt
    }, {
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const image = res.data.images?.find(img =>
      img.imageUrl?.startsWith('https://') &&
      (img.imageUrl.endsWith('.jpg') || img.imageUrl.endsWith('.png'))
    );

    if (image?.imageUrl) {
      console.log("✅ Serper image used.");
      return image.imageUrl;
    }
  } catch (err) {
    console.warn("❌ Serper failed:", err.message);
  }

  // 2. Try DuckDuckGo
  try {
    const html = await axios.get('https://duckduckgo.com/', { params: { q: prompt } });
    const vqdMatch = html.data.match(/vqd='(.+?)'/);
    if (!vqdMatch) throw new Error("No vqd token");

    const vqd = vqdMatch[1];
    const ddgRes = await axios.get('https://duckduckgo.com/i.js', {
      params: { q: prompt, vqd, o: 'json' },
      headers: {
        'Referer': 'https://duckduckgo.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const image = ddgRes.data.results.find(img =>
      img.image?.startsWith('https://') &&
      (img.image.endsWith('.jpg') || img.image.endsWith('.png'))
    );

    if (image?.image) {
      console.log("✅ DuckDuckGo image used.");
      return image.image;
    }
  } catch (err) {
    console.warn("⚠️ DuckDuckGo fallback failed:", err.message);
  }

  // 3. Try OpenGraph from news link
  if (fallbackUrl) {
    try {
      const page = await axios.get(fallbackUrl);
      const metaMatch = page.data.match(/<meta property="og:image" content="([^"]+)"/i);
      if (metaMatch && metaMatch[1].startsWith('http')) {
        console.log("📰 OpenGraph image used.");
        return metaMatch[1];
      }
    } catch (err) {
      console.warn("⚠️ OpenGraph fallback failed:", err.message);
    }
  }

  // 4. Final fallback
  console.log("🧊 Using static sport fallback image.");
  return fallbackImages[sport] || fallbackImages["football"];
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
    const imageUrl = await fetchImage(result.imagePrompt, result.sport, result.newsUrl);
    await postToDiscord({ ...result, imageUrl });
  } catch (err) {
    console.error("❌ Bot failed:", err.message);
  }
})();
