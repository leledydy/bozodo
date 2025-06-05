export const sports = [
  "football", "basketball", "tennis", "boxing", "baseball",
  "golf", "hockey", "MMA", "Formula 1", "cricket", "rugby", "cycling", "esports"
];

export function getRandomSport() {
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `You're a human sports columnist. Write a short (≤ 300 words), professional and passionate column for today's ${sport} event.

Include:
- Real or trending teams/players
- Tactics or strategies
- Match details or predictions
- A clever closing sentence

End with: Image prompt: [short visual scene idea for illustration]`;
}
