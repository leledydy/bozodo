// bot.js
import 'dotenv/config';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import axios from 'axios';

import {
  getSportPostData,
  buildPrompt,
} from './sports.js';

const TZ = 'Asia/Tokyo';
const MENTION = String(process.env.MENTION_EVERYONE || 'false').toLowerCase() === 'true';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CLI: --sport=soccer  --interval=3600000
const argv = Object.fromEntries(process.argv.slice(2).map(kv=>{
  const [k,v] = kv.replace(/^--/,'').split('=');
  return [k, v ?? true];
}));
const FORCE_SPORT = argv.sport || null;
const INTERVAL_MS = argv.interval ? Number(argv.interval) : null;

async function writeColumn(sport, whenText) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 180,
    messages: [
      { role: "system", content: "You are a concise, hype Gen Z sports columnist." },
      { role: "user", content: buildPrompt(sport, { whenText }) }
    ]
  });
  return (completion.choices?.[0]?.message?.content || "").trim();
}

async function postToDiscord({ title, url, image, body, caption, hashtags, sport, publishedAt }) {
  const contentHeader = MENTION ? "@everyone" : "";
  const embed = new EmbedBuilder()
    .setTitle(title || `Latest ${sport}`)
    .setURL(url || null)
    .setDescription(`${body}\n\n${hashtags}`)
    .setImage(image || null)
    .setTimestamp(new Date(publishedAt || Date.now()));

  // Prefer Webhook if available (no gateway on Railway)
  if (process.env.DISCORD_WEBHOOK_URL) {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      content: contentHeader ? `${contentHeader}\n${caption}` : caption,
      embeds: [embed.toJSON()]
    }, { timeout: 15000 });
    return "webhook";
  }

  // Bot token + channel
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_BOT_TOKEN);
    const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    await channel.send({ content: contentHeader ? `${contentHeader}\n${caption}` : caption, embeds: [embed] });
    await client.destroy();
    return "bot";
  }

  throw new Error("No Discord credentials set. Provide DISCORD_WEBHOOK_URL or DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID");
}

async function cycleOnce() {
  const data = await getSportPostData(FORCE_SPORT);
  if (!data.shouldPost) {
    console.log(`[SKIP] ${data.sport}: ${data.reason}`);
    return;
  }

  const body = await writeColumn(data.sport, data.whenText);
  const mode = await postToDiscord({
    title: data.title,
    url: data.url,
    image: data.image,
    body,
    caption: data.caption,
    hashtags: data.hashtags,
    sport: data.sport,
    publishedAt: data.publishedAt
  });

  console.log(`[POSTED via ${mode}] ${data.sport} • ${data.title}`);
}

(async () => {
  const run = async () => {
    try { await cycleOnce(); }
    catch (e) { console.error("Run error:", e?.message || e); }
  };

  if (INTERVAL_MS && Number.isFinite(INTERVAL_MS) && INTERVAL_MS > 0) {
    console.log(`Running every ${INTERVAL_MS} ms (${TZ})`);
    await run();
    setInterval(run, INTERVAL_MS);
  } else {
    await run();
  }
})();
