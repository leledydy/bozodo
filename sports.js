export function getRandomSport() {
  const sports = [
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
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `Write a Gen Z-style sports column for today's trending ${sport} event in Europe or Asia.
Keep it punchy and exciting. The article must include:
- 🔥 Match Highlights
- 🧠 Strategy Breakdown
- 🎯 Bold Prediction

Give it a bold title at the top. Keep the tone witty and modern.
End the article with: Image prompt: (describe a relevant, real-time image that represents the content visually).`;
}

export function generateHashtags(sport) {
  const tagMap = {
    soccer: "#Soccer #UEFA #AsiaCup",
    mma: "#MMA #UFC #FightHype",
    basketball: "#EuroLeague #AsianBasketball #CourtClash",
    volleyball: "#Volleyball #AsianGames #SpikeIt",
    "table tennis": "#TableTennis #PingPong #FastRally",
    badminton: "#Badminton #ShuttleSmash #AsianChampionships",
    boxing: "#Boxing #KO #TitleFight",
    cycling: "#Cycling #TourOfJapan #SpinSprint",
    hockey: "#Hockey #KHL #AsianLeague"
  };
  return tagMap[sport] || "#SportsBuzz";
}
