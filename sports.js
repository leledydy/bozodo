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
  return `Write a short, sharp Gen Z–style sports column for today's trending ${sport} match in Europe or Asia.
Keep it very brief:
- 1 line news highlight
- A short **Strategy**
- A bold **Prediction**`;
}

export function generateHashtags(sport) {
  const tags = {
    soccer: "#Football #EPL #AsiaCup #SoccerVibes",
    mma: "#MMA #FightNight #KnockoutVibes",
    basketball: "#Hoops #EuroLeague #BasketballAsia",
    volleyball: "#Volleyball #Spikers #SetItUp",
    "table tennis": "#TableTennis #PingPong #SpinMaster",
    badminton: "#Badminton #ShuttlePower #AsiaSmash",
    boxing: "#Boxing #FightHype #TitleShot",
    cycling: "#Cycling #TourAsia #RideStrong",
    hockey: "#Hockey #IceBattle #GoalLine"
  };
  return (tags[sport] || "#SportsBuzz") + " #bozodo #SportsUpdate";
}
