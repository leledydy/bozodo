// sports.js — Fresh news, Europe/Asia focus, image-validated

import axios from "axios";
import RSSParser from "rss-parser";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(tz);

const JPN_TZ = "Asia/Tokyo";
const WINDOW_DAYS = 2;

export const sportsList = [
  "soccer","mma","basketball","volleyball","table tennis","badminton",
  "boxing","tennis","golf","formula 1","cycling","hockey"
];

// Weighted to prefer soccer/boxing/hockey/golf
const weightedSports = [
  "soccer","soccer","soccer","soccer",
  "boxing","boxing","boxing",
  "hockey","hockey","hockey",
  "golf","golf","golf",
  "mma","basketball","volleyball","table tennis","badminton","tennis","formula 1","cycling"
];

export function getRandomSport() {
  return weightedSports[Math.floor(Math.random() * weightedSports.length)];
}

export function buildPrompt(sport, context = {}) {
  const when = context.whenText ? ` (${context.whenText})` : "";
  return `Write a short, catchy Gen Z–style sports column for today's trending ${sport} match in Europe or Asia${when}.

Use this format:
- 1-line highlight of what's happening today
- Bolded **Strategy** section (1–2 lines)
- Bolded **Prediction** section (1 line)

Keep it under 100 words. No hashtags. No image prompt.`;
}

export function generateHashtags(sport) {
  const tags = {
    soccer: "#Football #UEFA #EPL #LaLiga #SerieA #AFC #MatchDay",
    mma: "#MMA #UFC #FightNight",
    basketball: "#Basketball #EuroLeague #FastBreak",
    volleyball: "#Volleyball #Spike #GameSetMatch",
    "table tennis": "#TableTennis #PingPong #SpinMaster",
    badminton: "#Badminton #ShuttleSmash #AsiaChampionship",
    boxing: "#Boxing #TitleFight #P4P #KO",
    tennis: "#Tennis #ATP #WTA #GrandSlam",
    golf: "#Golf #PGA #DPWorldTour #Birdie",
    "formula 1": "#F1 #Formula1 #RaceDay #PolePosition",
    cycling: "#Cycling #Peloton #Tour",
    hockey: "#Hockey #NHL #IceHockey #GameDay"
  };
  return tags[sport] || "#Sports";
}

// ---- internals for fetching Guardian + RSS ----
const parser = new RSSParser({ customFields: { item: [["media:content", "media", { keepArray: true }], ["media:thumbnail", "mthumb", { keepArray: true }]] } });
const RSS_FEEDS = {
  soccer: ["https://www.espn.com/espn/rss/soccer/news","http://feeds.bbci.co.uk/sport/football/rss.xml"],
  boxing: ["http://www.espn.com/espn/rss/boxing/news","http://feeds.bbci.co.uk/sport/boxing/rss.xml"],
  hockey: ["http://www.espn.com/espn/rss/nhl/news","http://feeds.bbci.co.uk/sport/ice-hockey/rss.xml"],
  golf: ["http://www.espn.com/espn/rss/golf/news","http://feeds.bbci.co.uk/sport/golf/rss.xml"],
  basketball: ["https://www.espn.com/espn/rss/nba/news"],
  volleyball: ["https://www.insidethegames.biz/rss/sports/volleyball"],
  "table tennis": ["https://www.insidethegames.biz/rss/sports/table-tennis"],
  badminton: ["https://www.insidethegames.biz/rss/sports/badminton"],
  mma: ["http://www.espn.com/espn/rss/mma/news","https://www.ufc.com/rss/news"],
  tennis: ["http://feeds.bbci.co.uk/sport/tennis/rss.xml"],
  "formula 1": ["http://feeds.bbci.co.uk/sport/formula1/rss.xml","https://www.formula1.com/content/fom-website/en/latest/all.xml"],
  cycling: ["http://feeds.bbci.co.uk/sport/cycling/rss.xml"]
};

async function guardianSearch({ sport, fromISO, toISO }) {
  if (!process.env.GUARDIAN_API_KEY) return [];
  const qMap = { soccer:"football", boxing:"boxing", hockey:"ice hockey OR hockey", golf:"golf", basketball:"basketball",
    volleyball:"volleyball","table tennis":"\"table tennis\"",badminton:"badminton",mma:"mma OR ufc",tennis:"tennis","formula 1":"\"formula 1\" OR f1",cycling:"cycling" };
  const q = qMap[sport] || sport;
  try {
    const { data } = await axios.get("https://content.guardianapis.com/search", {
      params: { "api-key": process.env.GUARDIAN_API_KEY, q: `${q} AND (Europe OR Asian OR Asia)`,
        "from-date": fromISO, "to-date": toISO, "order-by":"newest","page-size":6,"show-fields":"thumbnail,trailText" },
      timeout: 12000
    });
    return (data?.response?.results||[]).map(r=>({
      title:r.webTitle,url:r.webUrl,publishedAt:r.webPublicationDate,image:r.fields?.thumbnail||null,
      summary:r.fields?.trailText||"",source:"The Guardian"}));
  } catch { return []; }
}

async function rssFallback({ sport, fromDay, toDay }) {
  const feeds = RSS_FEEDS[sport] || [];
  const all=[];
  for(const feed of feeds){
    try {
      const res=await parser.parseURL(feed);
      for(const item of res.items||[]){
        const pub=item.isoDate||item.pubDate; if(!pub) continue;
        const t=dayjs(pub); if(!t.isValid()) continue;
        if(t.isBefore(fromDay)||t.isAfter(toDay.add(1,"day"))) continue;
        let img=null;
        if(item.enclosure?.url) img=item.enclosure.url;
        if(!img && item.media?.length) {const m=item.media.find(x=>x.$?.url); if(m) img=m.$.url;}
        if(!img && item.mthumb?.length){const m=item.mthumb.find(x=>x.$?.url); if(m) img=m.$.url;}
        all.push({title:item.title,url:item.link,publishedAt:t.toISOString(),image:img,summary:item.contentSnippet||"",source:res.title||"RSS"});
      }
    } catch{}
  }
  return all;
}

async function validateImage(url){
  if(!url) return null;
  try {
    const head=await axios.head(url,{timeout:10000,maxRedirects:3,validateStatus:s=>s<400});
    return String(head.headers["content-type"]||"").startsWith("image/") ? url : null;
  } catch{return null;}
}

function humanWhen(pub,now){
  const diffH=now.diff(pub,"hour");
  if(diffH<1) return"just now";
  if(diffH<24) return`${diffH}h ago`;
  const d=now.diff(pub,"day");
  if(d<=2) return`${d}d ago`;
  return pub.format("MMM D");
}

function extractTeamTags(title){
  if(!title) return[];
  const m=title.match(/([\p{L}\p{N} .'-]{2,})\s+(?:vs\.?|v)\s+([\p{L}\p{N} .'-]{2,})/iu);
  if(!m) return[];
  const tagify=s=>"#"+s.replace(/[^A-Za-z0-9]+/g,"").slice(0,20);
  return [tagify(m[1]),tagify(m[2])];
}
const uniq=arr=>[...new Set(arr.filter(Boolean))];

export function buildCaptionAndHashtags(sport, story){
  const clean=s=>(s||"").replace(/<[^>]*>/g,"").trim();
  const title=clean(story?.title); const src=story?.source?` • ${story.source}`:"";
  const when=story?.whenText?` (${story.whenText})`:"";
  const caption=title?`${title}${src}${when}`:`Latest ${sport} update${src}${when}`;
  const base=(generateHashtags(sport)||"").split(/\s+/); const dyn=extractTeamTags(title);
  return{caption,hashtags:uniq([...base,...dyn]).slice(0,8).join(" ")};
}

export async function getSportPostData(sportArg){
  const now=dayjs().tz(JPN_TZ);
  const fromDay=now.subtract(WINDOW_DAYS,"day").startOf("day");
  const toDay=now.endOf("day");
  const fromISO=fromDay.format("YYYY-MM-DD");
  const toISO=now.add(1,"day").format("YYYY-MM-DD");

  const sport=sportArg||getRandomSport();
  let candidates=await guardianSearch({sport,fromISO,toISO});
  if(!candidates.length) candidates=await rssFallback({sport,fromDay,toDay});
  const filtered=candidates.filter(c=>{const t=dayjs(c.publishedAt);return t.isValid()&&t.isAfter(fromDay)&&t.isBefore(now.add(1,"day"));});

  for(const c of filtered){
    const img=await validateImage(c.image);
    if(img){
      const whenText=humanWhen(dayjs(c.publishedAt).tz(JPN_TZ),now);
      const {caption,hashtags}=buildCaptionAndHashtags(sport,{...c,whenText});
      return{sport,shouldPost:true,title:c.title,url:c.url,image:img,publishedAt:c.publishedAt,source:c.source,whenText,caption,hashtags};
    }
  }
  return{sport,shouldPost:false,reason:"No recent, image-backed story within 2 days."};
}
