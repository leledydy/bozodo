export function getRandomSport() {
  const sports = [
    "football", "basketball", "tennis", "mma", "esports",
    "cricket", "rugby", "baseball", "golf", "cycling"
  ];
  return sports[Math.floor(Math.random() * sports.length)];
}

export function buildPrompt(sport) {
  const prompts = {
    football: `Write a sports column about today's most anticipated football match. Include tactical breakdowns, highlight moments, key players, fan hype, and a bold prediction. Wrap it with a short prompt to generate a photo of the current game or athlete.`,
    
    basketball: `Write a basketball column Gen Z style. Highlight key matchups, clutch plays, team stats, and bold predictions. Make it witty and smart. Add a short image prompt at the end for the current NBA or college game.`,
    
    tennis: `Cover a trending tennis match. Add drama, strategy, player momentum, and who might win. Include key historical context or rivalries. End with a short image prompt related to the players or match.`,
    
    mma: `Give us an edgy MMA column with predictions, takedown strategies, fighter background, and some heat. Make it sound like it’s written by a passionate insider. Include a short prompt to generate a photo of the main event.`,
    
    esports: `Write a fast-paced esports column covering a trending match in League, Valorant, or CS2. Drop terms Gen Z understands, breakdown team comps, and predict the W. End with an image prompt to generate an esports arena or player moment.`,
    
    cricket: `Create a hype column for a T20 or ODI cricket match. Include batsmen form, pitch report, strategies, and bold predictions. Add a punchy ending and an image prompt for the match or stadium.`,
    
    rugby: `Write a gritty rugby column about a current test match. Include highlight plays, tactics, and crowd energy. Predict who might win. End with a short image prompt based on the game.`,
    
    baseball: `Write a Gen Z baseball column about today's most talked-about matchup. Break down plays, strategy, and player form. Add a spicy prediction. End with a quick image prompt related to the event.`,
    
    golf: `Write a chill but data-rich column on a trending golf tournament. Highlight top players, strategies, course conditions, and bold picks. Wrap it with an image prompt of the course or top golfer.`,
    
    cycling: `Write a pumped-up cycling column about today’s big tour stage. Talk route difficulty, tactics, teams, and likely winners. Close with an image prompt of the peloton or mountain stage.`
  };

  return prompts[sport] || `Write a fun and modern sports column about today's ${sport} event with prediction, highlight, strategy, and bold claims. Include a short image prompt at the end.`;
}
