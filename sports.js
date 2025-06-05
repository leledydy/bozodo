export const sports = [
  "football", "basketball", "tennis", "boxing", "baseball", "golf",
  "hockey", "MMA", "Formula 1", "cricket", "rugby", "cycling", "esports"
];

export function getRandomSport() {
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `You are an experienced, witty sports columnist. Write a short (≤ 300 words), professional column for Discord readers about a recent or upcoming major ${sport} match.

Include:
- Match or team names involved (real, trending if possible)
- Key players or coaches
- Highlight or performance details
- Tactical strategies expected or observed
- A bold prediction
- Ending with a clever or thoughtful closing line

Write in paragraph form, no lists or titles. Make it feel human, passionate, and insightful.

At the end, include one line:
Image prompt: A vivid description that matches this article.`;
}
