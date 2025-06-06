import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { buildPrompt, generateHashtags } from './sports.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supportedSports = [
  "soccer", "basketball", "boxing", "mma", "volleyball", "badminton", "table tennis",
  "cycling", "hockey", "tennis", "golf", "formula 1"
];

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
  tennis: "https://images.unsplash.com/photo-1593113598372-e5fc4f84cf2c",
  golf: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d",
  "formula 1": "https://images.unsplash.com/photo-1593697820732-6641d35b7697",
  default: "https://images.unsplash.com/photo-1547347298-4074fc3086f0"
};

function getTwoRandomSports() {
  const shuffled = supportedSports.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 2);
}

async function fetchLatestNews(sport) {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const currentYear = now.getFullYear().toString();

  try {
    const res = await axios.post('https://google.serper.dev/news', {
      q: `${sport} match OR fixture OR schedule OR preview ${todayStr} OR ${tomorrowStr} ${currentYear}`,
    }, {
      headers: {
        'X-API-KEY': process.env.SERPAPI_KEY,
        'Content-Type': 'application/json'
      }
    });

    const news = res.data.news || [];
    const match = news.find(article => {
      const text = `${article.title} ${article.snippet}`.toLowerCase();
      return (
        text.includes(todayStr.toLowerCase()) ||
        text.includes(tomorrowStr.toLowerCase()) ||
        text.includes("today") ||
        text.includes("tonight") ||
        text.includes("tomorrow") ||
        text.includes("fixture") ||
        text.includes("preview") ||
        text.includes(currentYear)
      );
    });

    const headline = match?.title || news[0]?.title || "";
    const summary = match?.snippet || news[0]?.snippet || "";

    return headline ? `${headline} - ${summary}` : "";
  } catch (err) {
    console.warn(`⚠️ Failed to fetch news for ${sport}:`, err.message);
    return "";
  }
}

async function generateColumn(sport) {
  const latestNews = await fetchLatestNews(sport);
  const systemPrompt = `You're a Gen Z-style sports columnist. Write a short, punchy, info-packed article (under 100 words) about the most relevant ${sport} match or headline today or tomorrow.

Structure:
- **Bold 1-line news summary**
- **Key Players:** 1–2 top names expected to shine
- **Strategy:** 1 key tactic or coaching edge
- **Prediction:** short bold forecast (winner, scoreline, or twist)

No intro or conclusion. Format with markdown bolding. Do NOT mention 'Image prompt'.`;

  const userPrompt = latestNews
    ? `Write based on this headline:\n"${latestNews}"`
    : buildPrompt(sport);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.85,
    max_tokens: 400
  });

  const fullText = completion.choices[0].message.content.trim();

  const cleanedText = fullText
    .replace(/(^|\n)Image prompt:.*(\n|$)/gi, "")
    .replace(/^(#+\s*)/gm, "")
    .replace(/\bStrategy\b:/gi, "**Strategy:**")
    .replace(/\bPrediction\b:/gi, "**Prediction:**")
    .replace(/\bKey Players\b:/gi, "**Key Players:**")
    .trim();

  return {
    sport,
    content: cleanedText,
    imageUrl: fallbackImages[sport] || fallbackImages.default,
    hashtags: generateHashtags(sport)
  };
}

async function postToDiscord(articles) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

  client.once('ready', async () => {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) throw new Error("Invalid channel");

      const embed = new EmbedBuilder()
        .setTitle("🏆 DAILY SPORTS UPDATE")
        .setColor(0xff4500)
        .setFooter({ text: "🖋️ Written by bozodo" })
        .setTimestamp();

      let combinedDescription = "";

      for (const article of articles) {
        combinedDescription += `🎯 **${article.sport.toUpperCase()}**\n${article.content}\n${article.hashtags}\n\n`;
      }

      embed.setDescription(combinedDescription.trim());

      // Use image of the first sport
      embed.setImage(articles[0].imageUrl);

      await channel.send({ embeds: [embed], content: "@everyone" });

      console.log("✅ Sports column posted.");
    } catch (err) {
      console.error("❌ Discord post error:", err.message);
    } finally {
      client.destroy();
    }
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

// MAIN
async function main() {
  console.log("🚀 Cron job started at", new Date().toISOString());

  try {
    const sports = getTwoRandomSports();
    const articles = [];

    for (const sport of sports) {
      const article = await generateColumn(sport);
      articles.push(article);
    }

    await postToDiscord(articles);
  } catch (err) {
    console.error("❌ Bot failed:", err);
    process.exit(1);
  }
}

main();
