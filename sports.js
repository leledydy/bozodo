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
  return `Write a Gen Z-style sports column for today's trending ${sport} match or event in Europe or Asia. 
Keep it fun and snappy. Include:
- A bold article title
- Match highlights (summarized)
- Key strategy or twist
- A bold prediction
- End with: Image prompt: (describe a related photo)`;
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
