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

const trendingTags = {
  football: ["#FootballFrenzy", "#GameDay", "#TouchdownTime"],
  basketball: ["#NBA", "#BallIsLife", "#HoopDreams"],
  tennis: ["#GrandSlam", "#AceLife", "#TennisVibes"],
  MMA: ["#UFC", "#OctagonEnergy", "#FightNight"],
  "Formula 1": ["#F1", "#LightsOutAndAwayWeGo", "#PolePosition"],
  boxing: ["#BoxingNight", "#TKO", "#FightGame"],
  cricket: ["#CricketFever", "#WicketWatch", "#Powerplay"],
  rugby: ["#RugbyLife", "#TryTime", "#ScrumDown"],
  golf: ["#GolfLife", "#TeeTime", "#BirdieHunt"],
  baseball: ["#MLB", "#HomeRun", "#PlayBall"],
  cycling: ["#TourTime", "#RideHard", "#PelotonPower"],
  hockey: ["#PuckDrop", "#IceBattle", "#GoalieMode"],
  esports: ["#GG", "#ClutchPlay", "#EsportsElite"]
};

export function getRandomSport() {
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  const tags = trendingTags[sport]?.slice(0, 2).join(" ") || "#SportsTalk";
  return `Write a short sports article for Gen Z readers about today's ${sport} match or event.

Use a witty, casual tone with Gen Z slang. Imagine it's for a viral sports blog or Discord post. Include:

- Big match/event highlights
- Key player moments or stats
- Realistic strategic insights
- Bold prediction for what's next
- Make it feel hype, like a fun rant or hot take
- End with the hashtags: ${tags}
- Then add "Image prompt: ..." for visuals.`;
}
