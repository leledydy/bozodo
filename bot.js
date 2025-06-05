import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';
import { getRandomSport, buildPrompt } from './sports.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const webhook = process.env.DISCORD_WEBHOOK_URL;

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
    model: 'gpt-4',
    messages: [
      {
        role: "system",
        content: "You are a witty, informed sports columnist writing for a daily Discord update. Also include an image prompt."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    max_tokens: 600
  });

  const fullText = completion.choices[0].message.content.trim();
  const match = fullText.match(/Image prompt:\s*(.+)/i);
  const imagePrompt = match ? match[1].trim() : `A dramatic ${sport} scene`;
  const article = fullText.replace(/Image prompt:.*/i, "").trim();

  return {
    sport,
    content: article,
    imagePrompt
  };
}

async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024"
  });

  return response.data[0].url;
}

async function postToDiscord({ sport, content, imageUrl }) {
  const emoji = sportEmojis[sport] || "🏟️";
  const formattedSport = sport.charAt(0).toUpperCase() + sport.slice(1);

  const embed = {
    title: `${emoji} ${formattedSport} Daily Update`,
    description: content.trim().replace(/\n+/g, '\n\n'),
    color: 0x1e90ff,
    footer: {
      text: "🖋️ Written by bozodo"
    },
    image: {
      url: imageUrl
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
    const imageUrl = await generateImage(result.imagePrompt);
    await postToDiscord({ ...result, imageUrl });
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
