import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const categories = ["Countries","Anime","Football","Food","Gaming"];
const pairs: Record<string,[string,string][]> = {
  Countries:[["France","Italy"],["Japan","South Korea"],["Pakistan","India"],["Canada","Australia"],["Brazil","Argentina"],["Spain","Portugal"]],
  Anime:[["One Piece","Naruto"],["Dragon Ball","Bleach"],["Attack on Titan","Vinland Saga"],["Demon Slayer","Jujutsu Kaisen"],["JoJo's Bizarre Adventure","Hunter x Hunter"]],
  Football:[["Barcelona","Real Madrid"],["Manchester City","Liverpool"],["Messi","Ronaldo"],["Champions League","World Cup"],["PSG","Bayern Munich"]],
  Food:[["Pizza","Pasta"],["Burger","Hot dog"],["Sushi","Ramen"],["Tacos","Burritos"],["Pancakes","Waffles"]],
  Gaming:[["Minecraft","Roblox"],["Fortnite","Apex Legends"],["PlayStation","Xbox"],["GTA","Red Dead Redemption"],["Mario Kart","Crash Team Racing"]]
};
const random=(n:number)=>Math.floor(Math.random()*n);
const makeCode=()=>Math.random().toString(36).slice(2,8).toUpperCase();

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try {
    const auth=req.headers.get("Authorization")||"";
    const token=auth.replace("Bearer ","");
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user) throw new Error("Please refresh the page and try again.");
    const body=await req.json();
    const action=body.action;
    const getRoom=async(code:string)=>{
      const {data,error}=await admin.from("rooms").select("*").eq("code",String(code||"").toUpperCase()).single();
      if(error||!data) throw new Error("Room not found. Check the room code.");
      return data;
    };
    const state=async(room:any)=>{
      const [{data:players,error:pErr},{data:assignment,error:aErr}]=await Promise.all([
        admin.from("players").select("id,display_name,is_host,joined_at").eq("room_id",room.id).order("joined_at"),
        admin.from("assignments").select("role,word,category").eq("room_id",room.id).eq("round_number",room.round_number).eq("user_id",user.id).maybeSingle()
      ]);
      if(pErr) throw pErr; if(aErr) throw aErr;
      return {room,players,assignment};
    };
    if(action==="create_room"){
      const name=String(body.name||"").trim().slice(0,18); if(!name) throw new Error("Enter a player name.");
      let code=makeCode();
      for(let i=0;i<5;i++){const {data}=await admin.from("rooms").select("id").eq("code",code).maybeSingle();if(!data)break;code=makeCode();}
      const {data:room,error}=await admin.from("rooms").insert({code,host_user_id:user.id}).select().single();if(error)throw error;
      const {error:pe}=await admin.from("players").insert({room_id:room.id,user_id:user.id,display_name:name,is_host:true});if(pe)throw pe;
      return Response.json(await state(room),{headers:cors});
    }
    if(action==="join_room"){
      const name=String(body.name||"").trim().slice(0,18);if(!name)throw new Error("Enter a player name.");
      const room=await getRoom(body.code);
      const {data:existing}=await admin.from("players").select("id").eq("room_id",room.id).eq("user_id",user.id).maybeSingle();
      if(!existing){
        const {count,error:ce}=await admin.from("players").select("*",{count:"exact",head:true}).eq("room_id",room.id);if(ce)throw ce;
        if((count||0)>=12)throw new Error("This room is full (12 players maximum).");
        if(room.status==="active")throw new Error("This round has already started. Ask the host to start a new room.");
        const {error}=await admin.from("players").insert({room_id:room.id,user_id:user.id,display_name:name});if(error)throw error;
      }
      return Response.json(await state(room),{headers:cors});
    }
    if(action==="room_state"){
      const room=await getRoom(body.code);
      const {data:member}=await admin.from("players").select("id").eq("room_id",room.id).eq("user_id",user.id).maybeSingle();
      if(!member)throw new Error("You are not in this room.");
      return Response.json(await state(room),{headers:cors});
    }
    if(action==="start_round"||action==="next_round"){
      const room=await getRoom(body.code);
      if(room.host_user_id!==user.id)throw new Error("Only the room creator can start the next round.");
      const {data:players,error:pe}=await admin.from("players").select("user_id").eq("room_id",room.id);
      if(pe)throw pe;
      const count=players?.length||0;
      if(count<3||count>12)throw new Error("A game needs 3 to 12 players.");
      const chosen=body.category==="Random"||!categories.includes(body.category)?categories[random(categories.length)]:body.category;
      const pairList=pairs[chosen];const pair=pairList[random(pairList.length)];
      const normalWord=pair[0],imposterWord=pair[1];
      const imposterCount=count>=9?2:1;
      const whiteCount=count>=6?1:0;
      const indices=Array.from({length:count},(_,i)=>i).sort(()=>Math.random()-.5);
      const imposters=new Set(indices.slice(0,imposterCount));
      const whites=new Set(indices.slice(imposterCount,imposterCount+whiteCount));
      const round=room.round_number+1;
      const rows=(players||[]).map((p:any,i:number)=>({
        room_id:room.id,round_number:round,user_id:p.user_id,
        role:whites.has(i)?"mr_white":imposters.has(i)?"imposter":"normal",
        word:whites.has(i)?null:imposters.has(i)?imposterWord:normalWord,category:chosen
      }));
      const {error:ae}=await admin.from("assignments").insert(rows);if(ae)throw ae;
      const {data:updated,error:ue}=await admin.from("rooms").update({category:chosen,round_number:round,status:"active"}).eq("id",room.id).select().single();if(ue)throw ue;
      return Response.json(await state(updated),{headers:cors});
    }
    throw new Error("Unknown game action.");
  } catch(e) {
    return Response.json({error:e instanceof Error?e.message:"Unexpected server error."},{status:400,headers:cors});
  }
});