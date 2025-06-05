const sportsList = [
  "soccer",
  "mma",
  "basketball",
  "volleyball",
  "table tennis",
  "badminton",
  "boxing",
  "cycling",
  "hockey"
];

export function getRandomSport() {
  return sportsList[Math.floor(Math.random() * sportsList.length)];
}

export function buildPrompt(sport) {
  return `Write a short Gen Z–style sports column about today's trending ${sport} event in Europe or Asia.
Include:
- 🔥 a summary of current news or match result in 1–2 sentences
- **Strategy:** a short breakdown of team/player approach
- **Prediction:** a short bold guess of what might happen next

End the article with: Image prompt: (describe a matching visual)`;
}

export function generateHashtags(sport) {
  const tags = {
    soccer: "#Soccer #UEFA #AsiaCup",
    mma: "#MMA #UFC #FightHype",
    basketball: "#EuroLeague #AsiaBasketball",
    volleyball: "#Volleyball #SpikeLife",
    "table tennis": "#TableTennis #PingPong",
    badminton: "#Badminton #ShuttleSmash",
    boxing: "#Boxing #KnockoutZone",
    cycling: "#Cycling #TourAsia",
    hockey: "#Hockey #StickCheck"
  };
  return tags[sport] || "#SportsUpdate";
}
