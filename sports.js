export function getRandomSport() {
  const sports = [
    "football", "basketball", "tennis", "mma", "esports",
    "cricket", "rugby", "baseball", "golf", "cycling"
  ];
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  return `Give me a short and modern sports column about today's trending ${sport} event. 
Include highlight plays, strategy insights, bold predictions, and a bold title at the top. 
Write it like a Gen Z columnist who knows their stuff. End the article with:
Image prompt: (describe an image that would represent this article visually)`;
}

export function generateHashtags(sport) {
  const tagMap = {
    football: "#NFL #FootballNews #GameDay",
    basketball: "#NBA #BasketballUpdate #CourtVibes",
    tennis: "#TennisLife #GrandSlam #MatchPoint",
    mma: "#MMA #UFC #FightNight",
    esports: "#Esports #GGWP #GameOn",
    cricket: "#CricketWorld #T20 #BowledOut",
    rugby: "#Rugby #ScrumDown #TryTime",
    baseball: "#BaseballLife #MLB #HomeRun",
    golf: "#Golf #PGA #TeeTime",
    cycling: "#TourDeFrance #CyclingLife #RideOrDie"
  };
  return tagMap[sport] || "#SportsUpdate";
}
