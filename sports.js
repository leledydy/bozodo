export const sports = [
  "football", "basketball", "tennis", "boxing", "baseball",
  "golf", "hockey", "MMA", "Formula 1", "cricket", "rugby", "cycling", "esports"
];

export function getRandomSport() {
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `You're a professional sports columnist. Write a short (≤ 300 words) daily update for today's ${sport} event.

Include:
- Real teams, players, and strategic insight
- Key highlights or predictions
- A bold or witty closing

End with:
Image prompt: [describe a specific visual scene from your column]

Also include one real headline or article URL from a trusted sports news site as the last line.`;
}
