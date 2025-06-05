// sports.js

const sports = [
  "football",
  "basketball",
  "tennis",
  "MMA",
  "Formula 1",
  "boxing",
  "cricket",
  "rugby",
  "golf",
  "baseball",
  "cycling",
  "hockey",
  "esports"
];

export function getRandomSport() {
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `Write a short, professional sports column about today’s ${sport} match or event. 
Include:
- Realistic highlights
- Strategic insight
- One bold prediction
- Strong narrative structure with emotion
- Humor or wit if appropriate

End with: "Image prompt: ..." to describe what images would best fit this story.`;
}
