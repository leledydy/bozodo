// bot.js — Tries priority sports, fact-bound writing, posts via Webhook or Bot.

import 'dotenv/config';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getSportPostData, buildPrompt } from './sports.js';

const MENTION = String(process.env.MENTION_EVERYONE || 'false').toLowerCase() === 'true';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CLI: --sport=soccer  --interval=3600000
const argv = Object.fromEntries(process.argv.slice(2).map(kv=>{
  const [k,v]=kv.replace(/^--/,'').split('='); return [k, v ?? true];
}));
const FORCE_SPORT = argv.sport || null;
const INTERVAL_MS = argv.interval ? Number(argv.interval) : null;

// Priority order (tries each until one qualifies)
const PRIORITY_SPORTS = (process.env.FAVORITE_SPORTS ||
  "soccer,boxing,hockey,golf,mma,basketball,volleyball,table tennis,badminton,tennis,formula 1,cycling"
).split(",").map(s => s.trim());

async function writeColumn(sport, whenText, article) {
  // article: { title, factsText, source, url }
  const facts = [
    article?.title ? `• Title: ${article.title}` : null,
    article?.factsText ? `• Summary: ${article.factsText}` : null,
    article?.source ? `• Source: ${article.source}` : null,
    whenText ? `• Timing: ${whenText} (JST)` : null,
  ].filter(Boolean).join("\n");

  const sys = [
    "You are a concise, hype Gen Z sports columnist.",
    "STRICT RULES:",
    "• Use ONLY the facts provided below. Do NOT invent players, quotes, stats, scores, or locations.",
    "• If a detail is not in the facts, keep it generic (no made-up names or numbers).",
    "• Keep under 100 words. Markdown allowed (**Strategy**, **Prediction**)."
  ].join("\n");

  const user = [
    `Sport: ${sport}`,
    "Facts:",
    facts || "• (No extra facts available.)",
    "",
    "Write:",
    "- 1-line headline about what's happening today (match/angle).",
    "- **Strategy**: 1–2 lines (tactics/trend implied by facts).",
    "- **Prediction**: 1 line (generic if specifics are unknown).",
    "No hashtags. No image prompt."
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 180,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
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

  // Prefer Webhook (simpler on Railway)
  if (process.env.DISCORD_WEBHOOK_URL) {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      content: contentHeader ? `${contentHeader}\n${caption}` : caption,
      embeds: [embed.toJSON()]
    }, { timeout: 15000 });
    return "webhook";
  }

  // Fallback: Bot token + Channel
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
  const queue = FORCE_SPORT
    ? [FORCE_SPORT, ...PRIORITY_SPORTS.filter(s => s !== FORCE_SPORT)]
    : [...PRIORITY_SPORTS];

  let data = null;
  for (const s of queue) {
    const attempt = await getSportPostData(s);
    if (attempt.shouldPost) { data = attempt; break; }
    console.log(`[SKIP] ${s}: ${attempt.reason}`);
  }

  if (!data) {
    console.log("[SKIP] No valid sport story found.");
    return;
  }

  const body = await writeColumn(
    data.sport,
    data.whenText,
    { title: data.title, factsText: data.summaryText, source: data.source, url: data.url }
  );

  // (Optional sanity check: warn if body doesn't mention detected teams — left out by default)

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

// Runner
(async () => {
  const run = async () => { try { await cycleOnce(); } catch (e) { console.error("Run error:", e?.message || e); } };
  if (INTERVAL_MS && Number.isFinite(INTERVAL_MS) && INTERVAL_MS > 0) {
    console.log(`Running every ${INTERVAL_MS} ms`);
    await run();
    setInterval(run, INTERVAL_MS);
  } else {
    await run();
  }
})();
