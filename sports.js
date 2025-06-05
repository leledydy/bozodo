export const sports = [
  "football", "basketball", "tennis", "boxing", "baseball", "golf", "hockey",
  "MMA", "Formula 1", "cricket", "rugby", "cycling", "esports"
];

export function getRandomSport() {
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `You're an experienced sports columnist writing a fresh, witty daily column on today's ${sport} action. Include:

1. A compelling intro and context
2. Top highlight or memorable moment
3. Key strategic insight or stat
4. A bold but fun prediction
5. A closing line that makes people smile or think

Keep it under 300 words. Be human, clever, and colorful.`;
}