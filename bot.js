// bot.js — Railway-friendly, tries multiple sports, posts first valid story

import 'dotenv/config';
import OpenAI from 'openai';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getSportPostData, buildPrompt } from './sports.js';

const MENTION = String(process.env.MENTION_EVERYONE || 'false').toLowerCase() === 'true';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CLI
const argv = Object.fromEntries(process.argv.slice(2).map(kv=>{
  const [k,v]=kv.replace(/^--/,'').split('='); return [k,v??true];
}));
const FORCE_SPORT=argv.sport||null;
const INTERVAL_MS=argv.interval?Number(argv.interval):null;

// Priority order
const PRIORITY_SPORTS=[
  "soccer","boxing","hockey","golf",
  "mma","basketball","volleyball","table tennis",
  "badminton","tennis","formula 1","cycling"
];

async function writeColumn(sport,whenText){
  const completion=await openai.chat.completions.create({
    model:"gpt-4o-mini",temperature:0.8,max_tokens:180,
    messages:[
      {role:"system",content:"You are a concise, hype Gen Z sports columnist."},
      {role:"user",content:buildPrompt(sport,{whenText})}
    ]
  });
  return(completion.choices?.[0]?.message?.content||"").trim();
}

async function postToDiscord({title,url,image,body,caption,hashtags,sport,publishedAt}){
  const contentHeader=MENTION?"@everyone":"";
  const embed=new EmbedBuilder()
    .setTitle(title||`Latest ${sport}`).setURL(url||null)
    .setDescription(`${body}\n\n${hashtags}`)
    .setImage(image||null).setTimestamp(new Date(publishedAt||Date.now()));

  if(process.env.DISCORD_WEBHOOK_URL){
    await axios.post(process.env.DISCORD_WEBHOOK_URL,{
      content:contentHeader?`${contentHeader}\n${caption}`:caption,
      embeds:[embed.toJSON()]
    },{timeout:15000});
    return"webhook";
  }
  if(process.env.DISCORD_BOT_TOKEN&&process.env.DISCORD_CHANNEL_ID){
    const client=new Client({intents:[GatewayIntentBits.Guilds]});
    await client.login(process.env.DISCORD_BOT_TOKEN);
    const channel=await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    await channel.send({content:contentHeader?`${contentHeader}\n${caption}`:caption,embeds:[embed]});
    await client.destroy();
    return"bot";
  }
  throw new Error("No Discord credentials set.");
}

async function cycleOnce(){
  const queue=FORCE_SPORT?[FORCE_SPORT,...PRIORITY_SPORTS.filter(s=>s!==FORCE_SPORT)]:[...PRIORITY_SPORTS];
  let data=null;
  for(const s of queue){
    const attempt=await getSportPostData(s);
    if(attempt.shouldPost){data=attempt;break;}
    console.log(`[SKIP] ${s}: ${attempt.reason}`);
  }
  if(!data){console.log("[SKIP] No valid sport story found.");return;}
  const body=await writeColumn(data.sport,data.whenText);
  const mode=await postToDiscord({...data,body});
  console.log(`[POSTED via ${mode}] ${data.sport} • ${data.title}`);
}

(async()=>{
  const run=async()=>{try{await cycleOnce();}catch(e){console.error("Run error:",e?.message||e);}};
  if(INTERVAL_MS&&Number.isFinite(INTERVAL_MS)&&INTERVAL_MS>0){console.log(`Running every ${INTERVAL_MS} ms`);await run();setInterval(run,INTERVAL_MS);}else{await run();}
})();
