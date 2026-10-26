"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Player = { id: string; display_name: string; is_host: boolean; joined_at: string };
type Room = { id: string; code: string; host_user_id: string; category: string | null; round_number: number; status: string };
type Assignment = { role: "normal" | "imposter" | "mr_white"; word: string | null; category: string };

const categories = ["Countries", "Anime", "Football", "Food", "Gaming"];

export default function Home() {
  const [userId,setUserId] = useState("");
  const [name,setName] = useState("");
  const [roomCode,setRoomCode] = useState("");
  const [room,setRoom] = useState<Room|null>(null);
  const [players,setPlayers] = useState<Player[]>([]);
  const [assignment,setAssignment] = useState<Assignment|null>(null);
  const [category,setCategory] = useState("Random");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [copied,setCopied] = useState(false);
  const isHost = !!room && room.host_user_id === userId;
  const inviteUrl = typeof window !== "undefined" && room ? `${window.location.origin}/?room=${room.code}` : "";

  useEffect(() => {
    let alive=true;
    (async()=>{
      const {data,error}=await supabase.auth.getSession();
      if(error) setError(error.message);
      if(!data.session){
        const sign=await supabase.auth.signInAnonymously();
        if(sign.error) setError("Could not start a guest session. Enable Anonymous sign-ins in Supabase.");
        else if(alive) setUserId(sign.data.user.id);
      } else if(alive) setUserId(data.session.user.id);
      const params=new URLSearchParams(window.location.search);
      const code=params.get("room");
      if(code) setRoomCode(code.toUpperCase());
    })();
    return ()=>{alive=false;};
  },[]);

  async function callGame(action:string, extra:Record<string,unknown>={}) {
    const {data:{session}}=await supabase.auth.getSession();
    if(!session) throw new Error("Your guest session is not ready. Refresh and try again.");
    const {data,error}=await supabase.functions.invoke("game",{body:{action,...extra}});
    if(error) throw new Error(error.message || "Game request failed.");
    if(data?.error) throw new Error(data.error);
    return data;
  }

  async function refreshRoom(code:string) {
    const data=await callGame("room_state",{code});
    setRoom(data.room); setPlayers(data.players || []);
    if(data.assignment) setAssignment(data.assignment);
    else setAssignment(null);
  }

  useEffect(()=>{
    if(!room?.id) return;
    const channel=supabase.channel(`room-${room.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"players",filter:`room_id=eq.${room.id}`},()=>refreshRoom(room.code).catch(()=>{}))
      .on("postgres_changes",{event:"*",schema:"public",table:"rooms",filter:`id=eq.${room.id}`},()=>refreshRoom(room.code).catch(()=>{}))
      .subscribe();
    const timer=setInterval(()=>refreshRoom(room.code).catch(()=>{}),5000);
    return ()=>{supabase.removeChannel(channel);clearInterval(timer);};
  },[room?.id]);

  async function run(action:string,extra:Record<string,unknown>={}) {
    setBusy(true);setError("");
    try { return await callGame(action,extra); }
    catch(e) {setError(e instanceof Error?e.message:"Something went wrong.");}
    finally {setBusy(false);}
  }

  async function createRoom() {
    if(!name.trim()) return setError("Enter your name first.");
    const data=await run("create_room",{name:name.trim()});
    if(data?.room) {setRoom(data.room);setPlayers(data.players||[]);setAssignment(null);}
  }
  async function joinRoom() {
    if(!name.trim() || !roomCode.trim()) return setError("Enter your name and room code.");
    const data=await run("join_room",{name:name.trim(),code:roomCode.trim().toUpperCase()});
    if(data?.room) {setRoom(data.room);setPlayers(data.players||[]);setAssignment(null);}
  }
  async function startRound() {
    const data=await run("start_round",{code:room?.code,category});
    if(data?.room) await refreshRoom(data.room.code);
  }
  async function nextRound() {
    const data=await run("next_round",{code:room?.code,category});
    if(data?.room) await refreshRoom(data.room.code);
  }
  async function copyInvite() {
    try {await navigator.clipboard.writeText(inviteUrl);setCopied(true);setTimeout(()=>setCopied(false),1600);}
    catch {setError("Copy wasn't available. You can copy the invitation link from your browser address bar.");}
  }

  const roleLabel=assignment?.role==="mr_white"?"MR. WHITE":assignment?.role==="imposter"?"IMPOSTER":"YOUR WORD";
  const roleClass=assignment?.role==="mr_white"?"white":assignment?.role==="imposter"?"red":"blue";
  const shareText=useMemo(()=>room?`Join my Imposter room: ${room.code}`:"",[room]);

  return <main className="shell">
    <div className="ambient one"/><div className="ambient two"/>
    <header className="topbar"><a className="brand" href="#"><span className="brandMark">I</span> IMPOSTER</a><span className="topTag">THE SECRET WORD GAME</span></header>
    {!room ? <section className="hero">
      <div className="eyebrow"><span className="pulse"/> MULTIPLAYER PARTY GAME</div>
      <h1>One word.<br/><em>One impostor.</em><br/>Who blends in?</h1>
      <p className="intro">Create a room, invite your friends, and take your secret assignments to Discord. The game happens in your voice call.</p>
      <div className="panel entryPanel">
        <label>Your player name</label><input value={name} maxLength={18} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/>
        <button className="primary" disabled={busy||!userId} onClick={createRoom}>{busy?"PLEASE WAIT…":"CREATE A ROOM"} <span>↗</span></button>
        <div className="or"><span/> OR JOIN A ROOM <span/></div>
        <div className="joinRow"><input value={roomCode} maxLength={6} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE"/><button className="secondary" disabled={busy||!userId} onClick={joinRoom}>JOIN</button></div>
        <div className="smallNote">3–12 PLAYERS · FREE TO PLAY · NO PLAYER ACCOUNTS</div>
      </div>
      <div className="heroOrb"><div className="orbCore">?</div><div className="orbRing ringA"/><div className="orbRing ringB"/><div className="orbLabel">TRUST<br/>NO ONE</div></div>
    </section> : <section className="lobby">
      <div className="lobbyHead"><div><div className="eyebrow"><span className="pulse"/> ROOM ACTIVE</div><h1>THE <em>LOBBY</em></h1></div><div className="roomCode"><small>ROOM CODE</small><strong>{room.code}</strong></div></div>
      <div className="panel roomPanel">
        <div className="roomTools"><div><small>PLAYERS IN ROOM</small><strong>{players.length}<span> / 12</span></strong></div><button className="secondary compact" onClick={copyInvite}>{copied?"COPIED ✓":"COPY INVITE ↗"}</button></div>
        <div className="playerGrid">{players.map((p,i)=><div className="playerTile" key={p.id}><div className={`avatar avatar${i%6}`}>{p.display_name.slice(0,1).toUpperCase()}</div><span>{p.display_name}</span>{p.is_host&&<b>HOST</b>}</div>)}</div>
        {room.status==="lobby" ? <div className="setup"><label>ROUND CATEGORY</label><select value={category} onChange={e=>setCategory(e.target.value)}><option>Random</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
          {isHost?<button className="primary" disabled={busy||players.length<3} onClick={startRound}>{players.length<3?"WAITING FOR 3 PLAYERS":"START GAME"} <span>↗</span></button>:<p className="waiting">Waiting for the room creator to start…</p>}
          <p className="smallNote">YOU NEED 3–12 PLAYERS TO START</p></div>
        : <div className="activeRound">
          <div className="roundMeta">ROUND {room.round_number} · {room.category?.toUpperCase()}</div>
          {assignment ? <div className={`assignment ${roleClass}`}><small>{roleLabel}</small><strong>{assignment.role==="mr_white"?"":assignment.word}</strong>{assignment.role==="mr_white"&&<div className="blank">NO WORD ASSIGNED</div>}<p>{assignment.role==="normal"?"Keep your word secret.":assignment.role==="imposter"?"Blend in. Your word is related, but different.":"You have no word. Listen carefully and bluff."}</p></div>:<div className="assignment waitingCard"><small>YOUR ASSIGNMENT</small><strong>••••••••</strong><p>Loading your private assignment…</p></div>}
          <div className="roundActions">{isHost?<button className="primary" disabled={busy} onClick={nextRound}>NEXT ROUND ↗</button>:<p className="waiting">The room creator controls the next round.</p>}</div>
          <p className="smallNote">KEEP YOUR SCREEN PRIVATE · DISCUSS ON DISCORD</p>
        </div>}
      </div>
      <button className="leave" onClick={()=>{setRoom(null);setPlayers([]);setAssignment(null);window.history.replaceState({}, "", "/");}}>LEAVE ROOM</button>
    </section>}
    {error&&<div className="error">{error}</div>}
    <footer><span>IMPOSTER © 2026</span><span>READ YOUR WORD. TRUST YOUR INSTINCT.</span></footer>
  </main>;
}
