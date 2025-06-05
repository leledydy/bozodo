import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const trustedDomains = [
  'cdn.pixabay.com',
  'static01.nyt.com',
  'cdn.espn.com',
  'img.bleacherreport.net',
  'media.gettyimages.com',
  'upload.wikimedia.org'
];

const fallbackImages = {
  football: "https://cdn.pixabay.com/photo/2016/11/18/17/20/football-1834432_1280.jpg",
  basketball: "https://cdn.pixabay.com/photo/2017/03/26/22/14/basketball-2178703_1280.jpg",
  tennis: "https://cdn.pixabay.com/photo/2014/08/15/06/21/tennis-418837_1280.jpg",
  boxing: "https://cdn.pixabay.com/photo/2016/11/21/16/13/box-1846350_1280.jpg"
};

const sportEmojis = {
  football: "🏈", basketball: "🏀", tennis: "🎾", boxing: "🥊", baseball: "⚾",
  golf: "⛳", hockey: "🏒", MMA: "🤼", "Formula 1": "🏎️", cricket: "🏏",
  rugby: "🏉", cycling: "🚴", esports: "🎮"
};

function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    const extOk = /\.(jpg|jpeg|png)(\?.*)?$/.test(parsed.pathname);
    const domainOk = trustedDomains.includes(parsed.hostname);
    return url.startsWith("https://") && extOk && domainOk;
  } catch {
    return false;
  }
}

function sanitizeUrl(url) {
  try {
    const clean = url.split('?')[0];
    return isValidImageUrl(clean) ? clean : null;
  } catch {
    return null;
  }
}

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
  try {
    const serper = await axios.post('https://google.serper.dev/images', { q: prompt }, {
      headers: { 'X-API-KEY': process.env.SERPAPI_KEY }
    });

    const image = serper.data.images?.find(img => isValidImageUrl(img.imageUrl));
    if (image) {
      const clean = sanitizeUrl(image.imageUrl);
      console.log("✅ Serper image used:", clean);
      return clean;
    }
  } catch (err) {
    console.warn("❌ Serper failed:", err.message);
  }

  try {
    const html = await axios.get('https://duckduckgo.com/', { params: { q: prompt } });
    const vqdMatch = html.data.match(/vqd='(.+?)'/);
    if (!vqdMatch) throw new Error("No vqd");

    const ddg = await axios.get('https://duckduckgo.com/i.js', {
      params: { q: prompt, vqd: vqdMatch[1], o: 'json' },
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://duckduckgo.com/' }
    });

    const image = ddg.data.results.find(img => isValidImageUrl(img.image));
    if (image) {
      const clean = sanitizeUrl(image.image);
      console.log("✅ DuckDuckGo image used:", clean);
      return clean;
    }
  } catch (err) {
    console.warn("⚠️ DuckDuckGo failed:", err.message);
  }

  if (fallbackUrl) {
    try {
      const page = await axios.get(fallbackUrl);
      const match = page.data.match(/<meta property="og:image" content="([^"]+)"/i);
      if (match) {
        const clean = sanitizeUrl(match[1]);
        if (clean) {
          console.log("📰 OpenGraph image used:", clean);
          return clean;
        }
      }
    } catch (err) {
      console.warn("⚠️ OpenGraph failed:", err.message);
    }
  }

  const fallback = fallbackImages[sport] || fallbackImages["football"];
  console.log("🧊 Using fallback image:", fallback);
  return fallback;
}

async function postToDiscord({ sport, content, imageUrl }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  const emoji = sportEmojis[sport] || "🏟️";
  const title = `🏆 𝗠𝗔𝗝𝗢𝗥 𝗨𝗣𝗗𝗔𝗧𝗘 — ${sport.toUpperCase()} 🏆`;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xff4500)
    .setFooter({ text: "🖋️ Written by bozodo" })
    .setTimestamp();

  if (isValidImageUrl(imageUrl)) {
    embed.setImage(imageUrl);
    embed.setDescription(content);
  } else {
    embed.setDescription(`${content}\n\n📷 [View image](${imageUrl})`);
  }

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
