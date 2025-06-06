const sportsList = [
  "soccer",
  "mma",
  "basketball",
  "volleyball",
  "table tennis",
  "badminton",
  "boxing",
  "tennis",
  "golf",
  "formula 1",
  "cycling",
  "hockey"
];

export function getRandomSport() {
  return sportsList[Math.floor(Math.random() * sportsList.length)];
}

export function buildPrompt(sport) {
  return `Write a short, catchy Gen Z–style sports column for today's trending ${sport} match in Europe or Asia.

Use this format:
- 1-line highlight of what's happening today
- Bolded **Strategy** section (1–2 lines)
- Bolded **Prediction** section (1 line)

Keep it under 100 words. No hashtags. No image prompt.`;
}

export function generateHashtags(sport) {
  const tags = {
    soccer: "#Football #AsiaCup #UEFA #SoccerVibes",
    mma: "#MMA #FightNight #KnockoutMode",
    basketball: "#Hoops #EuroLeague #FastBreak",
    volleyball: "#Volleyball #AsiaSpike #GameSetMatch",
    "table tennis": "#TableTennis #PingPongVibes #SpinMaster",
    badminton: "#Badminton #ShuttleSmash #AsiaChampionship",
    boxing: "#Boxing #TitleFight #RingReady",
    tennis: "#Tennis #GrandSlam #CourtKings",
    golf: "#Golf #FairwayFocus #MastersMood",
    "formula 1": "#Formula1 #RaceDay #PolePosition",
    cycling: "#Cycling #TourAsia #PedalPower",
    hockey: "#Hockey #IceBattle #GoalTime"
  };

  return tags[sport] || "#SportsBuzz";
}
