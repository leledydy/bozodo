import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const webhook = process.env.DISCORD_WEBHOOK_URL;

// Optional: assign sport icons
const sportEmojis = {
  football: "🏈",
  basketball: "🏀",
  tennis: "🎾",
  boxing: "🥊",
  baseball: "⚾",
  golf: "⛳",
  hockey: "🏒",
  MMA: "🤼",
  "Formula 1": "🏎️",
  cricket: "🏏",
  rugby: "🏉",
  cycling: "🚴",
  esports: "🎮"
};

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);

  console.log(`🎯 Generating column for: ${sport}`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4', // or 'gpt-3.5-turbo' if needed
    messages: [
      {
        role: "system",
        content: "You are a witty, informed sports columnist writing for a daily Discord update."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 500
  });

  return {
    sport,
    content: completion.choices[0].message.content
  };
}

async function postToDiscord({ sport, content }) {
  const emoji = sportEmojis[sport] || "🏟️";
  const formattedSport = sport.charAt(0).toUpperCase() + sport.slice(1);

  const embed = {
    title: `${emoji} ${formattedSport} Daily Update`,
    description: `>>> ${content.trim()}`,
    color: 0x1e90ff, // Dodger Blue
    footer: {
      text: "🖋️ Written by bozodo • powered by AI"
    },
    timestamp: new Date().toISOString()
  };

  await axios.post(webhook, {
    embeds: [embed]
  });

  console.log(`✅ Posted ${formattedSport} column to Discord.`);
}

(async () => {
  try {
    const result = await generateColumn();
    await postToDiscord(result);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
