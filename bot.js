import 'dotenv/config';
import { Configuration, OpenAI } from 'openai';
import axios from 'axios';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const webhook = process.env.DISCORD_WEBHOOK_URL;

async function generateColumn() {
  const sport = getRandomSport();
  const prompt = buildPrompt(sport);

  console.log(`🎯 Generating column for: ${sport}`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4', // or 'gpt-3.5-turbo' if you're on a lower plan
    messages: [
      { role: "system", content: "You are a witty, informed sports columnist writing for a daily Discord update." },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 500
  });

  return completion.choices[0].message.content;
}

async function postToDiscord(content) {
  await axios.post(webhook, {
    content: `📰 **Daily Sports Column**\n\n${content}`
  });

  console.log("✅ Posted to Discord.");
}

(async () => {
  try {
    const column = await generateColumn();
    await postToDiscord(column);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();