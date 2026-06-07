/* ─────────────────────────────────────────────────────────────
   SIDE HUDDLE v5 — screens (babel)
   ───────────────────────────────────────────────────────────── */
const { C, FONT, MONO, person, initials, TEAMS, FOLLOWED, FRIENDS_LIVE, MY_ROOMS, SUPER_HUDDLE, ROOM_MEMBERS, buildRoomMsgs, PICKER_TEAMS } = window.SH;
const { Dot, Avatar, TeamMark, BotByline, Stack, SourceTag, BotBody, Bubble } = window;

const SectionLabel = ({ children, color=C.text3, right }) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px'}}>
    <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color}}>{children}</span>
    {right}
  </div>
);

/* ════════════════ HOME ════════════════ */
function Home({ nav }){
  const [tab,setTab]=React.useState('super');
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:C.bg}}>
      {/* app bar */}
      <div style={{padding:'52px 18px 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:24,fontWeight:800,color:C.text,letterSpacing:'-0.6px',lineHeight:1}}>Side Huddle</div>
            <div style={{fontSize:12.5,color:C.text3,marginTop:4}}>Your teams. Your crew. One thread.</div>
          </div>
          <button onClick={()=>nav('me')} style={{padding:0,border:'none',background:'none',cursor:'pointer'}}><Avatar name="You" size={36}/></button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {/* FRIENDS NOW rail */}
        <div style={{marginBottom:6}}>
          <SectionLabel color={C.live} right={<span style={{fontSize:11,color:C.text3,fontWeight:600}}>{FRIENDS_LIVE.length} live</span>}>
            <span style={{display:'inline-flex',alignItems:'center',gap:7}}><Dot/> Friends now</span>
          </SectionLabel>
          <div style={{display:'flex',gap:10,overflowX:'auto',padding:'10px 18px 4px',scrollbarWidth:'none'}}>
            {FRIENDS_LIVE.map((f,i)=>(
              <button key={i} onClick={()=>nav('room', MY_ROOMS.find(r=>r.id===f.roomId)||MY_ROOMS[0])}
                style={{flexShrink:0,width:150,textAlign:'left',background:C.elev,border:`1px solid ${C.line}`,borderRadius:14,
                  padding:'12px 12px 12px',cursor:'pointer',fontFamily:FONT,position:'relative'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}>
                  <Avatar name={f.name} size={32} ring={C.elev}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:C.text,lineHeight:1.1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.name}</div>
                    <div style={{fontSize:10.5,color:C.text3,marginTop:2,display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}><Dot color={C.pos} size={5}/> in a room</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                  <TeamMark teamId={f.team} size={16} radius={4}/>
                  <span style={{fontSize:11.5,color:C.text2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.room}</span>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:C.accent,display:'flex',alignItems:'center',gap:5}}>Jump in <span style={{fontWeight:600}}>→</span></div>
              </button>
            ))}
          </div>
        </div>

        {/* segmented tabs */}
        <div style={{padding:'10px 18px 0',position:'sticky',top:0,background:C.bg,zIndex:5}}>
          <div style={{display:'flex',gap:4,background:C.elev,border:`1px solid ${C.line}`,borderRadius:12,padding:4}}>
            {[['super','Super Huddle'],['rooms','My Rooms']].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'9px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:FONT,
                fontSize:13.5,fontWeight:700,background:tab===id?C.accent:'transparent',color:tab===id?C.onAccent:C.text2,transition:'all .15s'}}>{label}</button>
            ))}
          </div>
        </div>

        {tab==='super' ? <SuperHuddle nav={nav}/> : <MyRooms nav={nav}/>}
        <div style={{height:96}}/>
      </div>
      <BottomNav active="home" nav={nav}/>
    </div>
  );
}

/* ── Super Huddle: read-only combined digest ── */
function SuperHuddle({ nav }){
  return (
    <div style={{padding:'14px 0 0'}}>
      {/* teams feeding it */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 18px 12px',overflowX:'auto',scrollbarWidth:'none'}}>
        {FOLLOWED.map(id=>(
          <div key={id} style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,background:C.elev,border:`1px solid ${C.line}`,borderRadius:20,padding:'5px 11px 5px 5px'}}>
            <TeamMark teamId={id} size={20} radius={6}/>
            <span style={{fontSize:11.5,fontWeight:600,color:C.text2}}>{TEAMS[id].abbr}</span>
          </div>
        ))}
        <button onClick={()=>nav('manage')} style={{flexShrink:0,fontSize:11.5,fontWeight:600,color:C.text3,background:'none',border:`1px dashed ${C.line}`,borderRadius:20,padding:'6px 12px',cursor:'pointer',fontFamily:FONT}}>＋ Teams</button>
      </div>

      <div style={{padding:'4px 18px 6px',display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:C.text3}}>Today</span>
        <div style={{flex:1,height:1,background:C.lineSoft}}/>
      </div>

      {SUPER_HUDDLE.map(item=>(
        <div key={item.id} style={{padding:'10px 18px',borderBottom:`1px solid ${C.lineSoft}`}}>
          <BotByline teamId={item.team} time={item.time} label={item.kind==='pred'?'market':item.kind==='post'?item.data.source:item.kind}/>
          <BotBody kind={item.kind} data={item.data}/>
        </div>
      ))}
      <div style={{padding:'18px',textAlign:'center'}}>
        <span style={{fontSize:12,color:C.text3}}>That's everything from your teams today.</span>
      </div>
    </div>
  );
}

/* ── My Rooms ── */
function MyRooms({ nav }){
  const host = MY_ROOMS.filter(r=>r.owner);
  const member = MY_ROOMS.filter(r=>!r.owner);

  const RoomCard = (r)=>(
    <button key={r.id} onClick={()=>nav('room',r)} style={{textAlign:'left',background:C.elev,border:`1px solid ${C.line}`,borderRadius:14,
      padding:'13px 14px',cursor:'pointer',fontFamily:FONT,position:'relative',width:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:11}}>
        <TeamMark teamId={r.team} size={40} radius={11}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:14.5,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>{r.name}</span>
            {r.live && <span style={{display:'inline-flex',alignItems:'center',gap:4,flexShrink:0}}><Dot size={5}/><span style={{fontSize:10,fontWeight:700,color:C.live,letterSpacing:'0.05em'}}>LIVE</span></span>}
          </div>
          <div style={{fontSize:12,color:C.text3,marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.preview}</div>
        </div>
        {r.unread>0 && <div style={{flexShrink:0,minWidth:20,height:20,borderRadius:10,background:C.accent,color:C.onAccent,
          fontFamily:MONO,fontSize:11,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 6px'}}>{r.unread}</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:11,paddingTop:11,borderTop:`1px solid ${C.lineSoft}`}}>
        {r.here.length>0
          ? <><Stack names={r.here} size={22} ring={C.elev}/><span style={{fontSize:11.5,color:C.text2}}>{r.here.slice(0,2).join(', ')}{r.here.length>2?` +${r.here.length-2}`:''} here now</span></>
          : <span style={{fontSize:11.5,color:C.text3}}>{r.members} members · quiet</span>}
        <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:C.accent}}>Open →</span>
      </div>
    </button>
  );

  const Group = ({ label, sub, rooms })=> rooms.length===0 ? null : (
    <div style={{marginBottom:18}}>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:C.text3}}>{label}</span>
        <span style={{fontSize:11,color:C.text3}}>· {sub}</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>{rooms.map(RoomCard)}</div>
    </div>
  );

  return (
    <div style={{padding:'16px 18px 0'}}>
      <button onClick={()=>nav('create')} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 14px',marginBottom:18,
        background:C.accentDim,border:`1px solid ${C.accentLine}`,borderRadius:14,cursor:'pointer',fontFamily:FONT}}>
        <div style={{width:34,height:34,borderRadius:'50%',background:C.accent,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <span style={{fontSize:20,color:C.onAccent,fontWeight:400,lineHeight:1}}>+</span>
        </div>
        <div style={{textAlign:'left'}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>Start a crew room</div>
          <div style={{fontSize:11.5,color:C.text3,marginTop:1}}>Invite-only · attached to a team</div>
        </div>
      </button>

      <Group label="You host" sub={`${host.length} room${host.length!==1?'s':''} you created`} rooms={host}/>
      <Group label="You're in" sub={`${member.length} room${member.length!==1?'s':''} you joined`} rooms={member}/>
    </div>
  );
}

/* ════════════════ ROOM (chat) ════════════════ */
function Room({ room, nav, onSwitch }){
  const [msgs,setMsgs]=React.useState(buildRoomMsgs);
  const [input,setInput]=React.useState('');
  const [showWho,setShowWho]=React.useState(false);
  const [showScore,setShowScore]=React.useState(false);
  const [showMenu,setShowMenu]=React.useState(false);
  const [pinned,setPinned]=React.useState(room.pinned||'');
  const scrollRef=React.useRef(null);
  const team=TEAMS[room.team];
  const watching=ROOM_MEMBERS.filter(m=>m.status==='watching'||m.status==='typing');
  const onlineCount=ROOM_MEMBERS.filter(m=>m.status!=='away').length;
  // friends in OTHER rooms — the jump rail
  const otherRooms = MY_ROOMS.filter(r=>r.live);

  React.useEffect(()=>{ setMsgs(buildRoomMsgs()); setInput(''); setPinned(room.pinned||''); setShowMenu(false); setShowScore(false); },[room.id]);
  React.useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; },[msgs]);

  const send=()=>{
    if(!input.trim()) return;
    setMsgs(prev=>[...prev,{id:'u'+Date.now(),type:'msg',from:'You',mine:true,time:'now',text:input.trim()}]);
    setInput('');
  };
  const grouped=msgs.map((m,i)=>{
    if(m.type!=='msg') return m;
    const prev=msgs[i-1];
    const showName=!prev||prev.type!=='msg'||prev.from!==m.from;
    return {...m,showName};
  });

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:C.bg,position:'relative'}}>
      {/* HEADER — compact, reclaims the top third; tinted with team identity */}
      <div style={{padding:'52px 12px 0',background:`linear-gradient(180deg, ${team?team.ink:'#000'}2e, ${team?team.ink:'#000'}00 72%), var(--elev)`,borderBottom:`1px solid ${C.line}`,boxShadow:`inset 0 2px 0 ${team?team.ink:'transparent'}`,flexShrink:0,transition:'background .3s'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'2px 2px 10px'}}>
          <button onClick={()=>nav('home')} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}}>
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M8 2L2 8l6 6" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <TeamMark teamId={room.team} size={34} radius={10}/>
          <button onClick={()=>setShowWho(true)} style={{flex:1,minWidth:0,background:'none',border:'none',padding:0,textAlign:'left',cursor:'pointer',fontFamily:FONT}}>
            <div style={{fontSize:15.5,fontWeight:700,color:C.text,lineHeight:1.15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{room.name}</div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
              <Stack names={watching.map(w=>w.name)} size={15} ring={C.elev}/>
              <span style={{fontSize:11.5,color:C.text2,whiteSpace:'nowrap'}}><span style={{color:C.pos}}>{onlineCount} here</span> · {watching.length} watching</span>
            </div>
          </button>
          {/* live score chip — tap to expand */}
          {room.live && (
            <button onClick={()=>setShowScore(s=>!s)} style={{flexShrink:0,display:'flex',alignItems:'center',gap:7,padding:'6px 10px',borderRadius:10,
              background:C.surface,border:`1px solid ${showScore?C.accentLine:C.line}`,cursor:'pointer',fontFamily:FONT}}>
              <Dot size={5}/>
              <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap'}}>21<span style={{color:C.text3}}>–</span>14</span>
              <svg width="9" height="6" viewBox="0 0 9 6" style={{transform:showScore?'rotate(180deg)':'none',transition:'.2s'}}><path d="M1 1l3.5 3.5L8 1" stroke={C.text3} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
            </button>
          )}
          <button onClick={()=>setShowMenu(true)} aria-label="Room options" style={{flexShrink:0,width:30,height:30,borderRadius:'50%',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="4" height="17" viewBox="0 0 4 17" fill="none"><circle cx="2" cy="2" r="2" fill={C.text2}/><circle cx="2" cy="8.5" r="2" fill={C.text2}/><circle cx="2" cy="15" r="2" fill={C.text2}/></svg>
          </button>
        </div>

        {/* expandable score detail */}
        {room.live && showScore && (
          <div style={{padding:'0 2px 10px',animation:'drop .2s ease'}}>
            <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'10px 14px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10}}>
              <div><div style={{fontSize:12.5,fontWeight:600,color:C.text}}>Bears</div><div style={{fontFamily:MONO,fontSize:24,fontWeight:600,color:C.text}}>21</div></div>
              <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:20,background:C.liveDim,border:`1px solid ${C.liveLine}`}}><Dot size={5}/><span style={{fontSize:10.5,fontWeight:700,color:C.live}}>Q3 · 4:22</span></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:12.5,fontWeight:500,color:C.text2}}>Lions</div><div style={{fontFamily:MONO,fontSize:24,fontWeight:600,color:C.text3}}>14</div></div>
            </div>
          </div>
        )}

        {/* FRIEND-JUMP RAIL — hop to rooms friends are in */}
        <div style={{display:'flex',gap:8,overflowX:'auto',padding:'0 0 10px',scrollbarWidth:'none',alignItems:'center'}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:C.text3,flexShrink:0,paddingRight:2}}>Jump</span>
          {otherRooms.map(r=>{
            const active=r.id===room.id;
            return (
              <button key={r.id} onClick={()=>!active&&onSwitch(r)} style={{flexShrink:0,display:'flex',alignItems:'center',gap:7,padding:'5px 11px 5px 5px',borderRadius:20,cursor:active?'default':'pointer',fontFamily:FONT,
                background:active?C.accentDim:C.surface,border:`1px solid ${active?C.accentLine:C.line}`}}>
                <Stack names={r.here.length?r.here:[r.name||'?']} size={18} max={2} ring={active?'#1a160c':C.surface}/>
                <span style={{fontSize:11.5,fontWeight:active?700:600,color:active?C.accent:C.text2,whiteSpace:'nowrap'}}>{r.name}</span>
                {!active && r.unread>0 && <span style={{width:6,height:6,borderRadius:'50%',background:C.accent}}/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* PINNED MESSAGE */}
      {pinned && (
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'9px 16px',background:C.accentDim,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z" stroke={C.accent} strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 13v8" stroke={C.accent} strokeWidth="1.7" strokeLinecap="round"/></svg>
          <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.accent,flexShrink:0}}>Pinned</span>
          <span style={{flex:1,minWidth:0,fontSize:12.5,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{pinned}</span>
          <button onClick={()=>setShowMenu(true)} style={{flexShrink:0,fontSize:11.5,fontWeight:700,color:C.text2,background:'none',border:'none',cursor:'pointer',fontFamily:FONT}}>Edit</button>
        </div>
      )}

      {/* MESSAGES */}
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'12px 0 8px'}}>
        {grouped.map(m=><Bubble key={m.id} msg={m} showName={m.type==='msg'?m.showName:false} onReply={()=>{}}/>)}
        <div style={{padding:'2px 14px 6px 53px'}}>
          <span style={{fontSize:11.5,color:C.text3,fontStyle:'italic'}}>Dan is typing…</span>
        </div>
      </div>

      {/* COMPOSER */}
      <div style={{padding:'10px 12px 12px',background:C.elev,borderTop:`1px solid ${C.line}`,flexShrink:0,display:'flex',gap:9,alignItems:'center'}}>
        <button aria-label="Camera" style={{width:38,height:38,borderRadius:'50%',background:C.surface,border:`1px solid ${C.line}`,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 8.6A1.6 1.6 0 014.6 7H7l1.1-1.7A1 1 0 019 4.8h6a1 1 0 01.8.5L17 7h2.4A1.6 1.6 0 0121 8.6v8.8A1.6 1.6 0 0119.4 19H4.6A1.6 1.6 0 013 17.4V8.6z" stroke={C.text2} strokeWidth="1.7"/><circle cx="12" cy="12.5" r="3.1" stroke={C.text2} strokeWidth="1.7"/></svg>
        </button>
        <div style={{flex:1,display:'flex',alignItems:'center',gap:8,background:C.surface2,border:`1px solid ${input.trim()?C.accentLine:C.line}`,borderRadius:22,padding:'9px 10px 9px 16px',transition:'border-color .15s'}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message the room…"
            style={{flex:1,minWidth:0,background:'none',border:'none',fontSize:15,color:C.text,outline:'none',fontFamily:FONT,caretColor:C.accent}}/>
          <button aria-label="Voice message" style={{flexShrink:0,width:26,height:26,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke={C.text2} strokeWidth="1.7"/><path d="M6 11a6 6 0 0012 0M12 17.5V20" stroke={C.text2} strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>
        <button onClick={send} aria-label="Send" style={{width:38,height:38,borderRadius:'50%',flexShrink:0,cursor:'pointer',border:'none',
          background:input.trim()?C.accent:C.surface,border:input.trim()?'none':`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'background .15s'}}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M1 7h12M7 1l6 6-6 6" stroke={input.trim()?C.onAccent:C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* ROOM OPTIONS MENU */}
      {showMenu && (
        <div style={{position:'absolute',inset:0,zIndex:85}}>
          <div onClick={()=>setShowMenu(false)} style={{position:'absolute',inset:0,animation:'fade .15s ease'}}/>
          <div style={{position:'absolute',top:96,right:12,width:218,background:C.elev,border:`1px solid ${C.line}`,borderRadius:14,overflow:'hidden',boxShadow:'0 14px 40px rgba(0,0,0,.55)',animation:'drop .16s ease'}}>
            {[
              { label: pinned?'Unpin message':'Pin a message', accent:true,
                icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z" stroke={C.accent} strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 13v8" stroke={C.accent} strokeWidth="1.7" strokeLinecap="round"/></svg>,
                onClick:()=>{ setPinned(pinned?'':'Bears up 21–14 in the 3rd — check in while you watch.'); setShowMenu(false); } },
              { label:'Invite people', icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="8" r="3.4" stroke={C.text2} strokeWidth="1.7"/><path d="M3.5 19c0-3.2 2.9-5.3 6.5-5.3M17 7v6M14 10h6" stroke={C.text2} strokeWidth="1.7" strokeLinecap="round"/></svg>, onClick:()=>setShowMenu(false) },
              { label:'Notifications', icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM9.5 20a2.5 2.5 0 005 0" stroke={C.text2} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>, onClick:()=>setShowMenu(false) },
              { label:'Leave room', danger:true, icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M14 4h5v16h-5M14 12H4m0 0l4-4m-4 4l4 4" stroke={C.neg} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>, onClick:()=>setShowMenu(false) },
            ].map((it,i,arr)=>(
              <button key={i} onClick={it.onClick} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 15px',background:'none',border:'none',
                borderBottom:i<arr.length-1?`1px solid ${C.lineSoft}`:'none',cursor:'pointer',fontFamily:FONT,textAlign:'left'}}>
                <span style={{width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{it.icon}</span>
                <span style={{fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',color:it.danger?C.neg:it.accent?C.accent:C.text}}>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showWho && <WhoSheet room={room} onClose={()=>setShowWho(false)}/>}
      <BottomNav active="home" nav={nav}/>
    </div>
  );
}

/* ── Who's in the room sheet ── */
function WhoSheet({ room, onClose }){
  const order={watching:0,typing:0,online:1,away:2};
  const sorted=[...ROOM_MEMBERS].sort((a,b)=>order[a.status]-order[b.status]);
  const label=s=>s==='watching'?'Watching the game':s==='typing'?'Typing…':s==='online'?'Active':'Away';
  const col=s=>s==='watching'?C.live:s==='typing'?C.pos:s==='online'?C.pos:C.text3;
  return (
    <div style={{position:'absolute',inset:0,zIndex:80,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',animation:'fade .2s ease'}}/>
      <div style={{position:'relative',background:C.elev,borderRadius:'22px 22px 0 0',border:`1px solid ${C.line}`,borderBottom:'none',animation:'sheet .3s cubic-bezier(.32,.72,0,1)',maxHeight:'74%',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 6px'}}><div style={{width:36,height:4,borderRadius:2,background:C.line}}/></div>
        <div style={{padding:'6px 18px 14px',borderBottom:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:C.text}}>{room.name}</div>
            <div style={{fontSize:12,color:C.text3,marginTop:2}}>{room.members} members · <span style={{color:C.pos}}>{ROOM_MEMBERS.filter(m=>m.status!=='away').length} active</span></div>
          </div>
          <button style={{padding:'8px 13px',borderRadius:10,background:C.accent,border:'none',color:C.onAccent,fontSize:12.5,fontWeight:700,cursor:'pointer',fontFamily:FONT}}>Invite</button>
        </div>
        <div style={{overflowY:'auto',padding:'8px 0 20px'}}>
          {sorted.map((m,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 18px'}}>
              <Avatar name={m.name} size={38}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{m.name}</div>
                <div style={{fontSize:11.5,color:col(m.status),marginTop:1,display:'flex',alignItems:'center',gap:5}}>
                  {(m.status==='watching')&&<Dot size={5}/>}{label(m.status)}{m.status==='away'?` · ${m.seen}`:''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════ CREATE ROOM ════════════════ */
function CreateRoom({ nav }){
  const [name,setName]=React.useState('');
  const [sel,setSel]=React.useState('CHI-NFL');
  const [league,setLeague]=React.useState('All');
  const leagues=['All','NFL','NBA','NHL','NCAAF'];
  const list=PICKER_TEAMS.filter(t=>league==='All'||t.league===league);
  const selTeam=PICKER_TEAMS.find(t=>`${t.abbr}-${t.league}`===sel);
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:C.bg}}>
      <div style={{padding:'52px 18px 12px',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>nav('home')} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M8 2L2 8l6 6" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{fontSize:18,fontWeight:800,color:C.text,letterSpacing:'-0.4px'}}>Start a crew room</span>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'4px 18px 0'}}>
        {/* name */}
        <label style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.text3}}>Room name</label>
        <input value={name} onChange={e=>setName(e.target.value.slice(0,40))} placeholder="e.g. The Boys, Sunday Crew…" maxLength={40}
          style={{width:'100%',marginTop:8,background:C.elev,border:`1px solid ${C.line}`,borderRadius:12,padding:'13px 14px',fontSize:15,color:C.text,outline:'none',fontFamily:FONT,caretColor:C.accent}}/>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:7}}>
          <span style={{fontSize:11.5,color:C.text3}}>🔒 Invite-only · attached to a team</span>
          <span style={{fontSize:11.5,color:C.text3,fontFamily:MONO}}>{name.length}/40</span>
        </div>

        {/* attach team */}
        <div style={{marginTop:22}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.text3,marginBottom:5}}>Attach to a team</div>
          <p style={{fontSize:12.5,color:C.text2,lineHeight:1.5,marginBottom:12}}>The room wakes up on game day and pulls in scores, news, and prediction prompts for {selTeam?selTeam.name:'your team'}.</p>
          <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:12,scrollbarWidth:'none'}}>
            {leagues.map(l=>(
              <button key={l} onClick={()=>setLeague(l)} style={{flexShrink:0,padding:'7px 14px',borderRadius:20,cursor:'pointer',fontFamily:FONT,fontSize:12.5,fontWeight:700,
                background:league===l?C.accent:C.elev,border:`1px solid ${league===l?C.accent:C.line}`,color:league===l?C.onAccent:C.text2}}>{l}</button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:9}}>
            {list.map((t,i)=>{
              const id=`${t.abbr}-${t.league}`; const on=sel===id;
              return (
                <button key={i} onClick={()=>setSel(id)} style={{padding:'10px 4px 9px',borderRadius:12,cursor:'pointer',fontFamily:FONT,position:'relative',
                  background:on?C.accentDim:C.elev,border:`1.5px solid ${on?C.accent:C.line}`,display:'flex',flexDirection:'column',alignItems:'center',gap:7}}>
                  <div style={{width:40,height:40,borderRadius:11,background:t.color,border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:MONO,fontSize:12,fontWeight:600,color:'#fff'}}>{t.abbr}</div>
                  <span style={{fontSize:11,fontWeight:600,color:on?C.accent:C.text2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%'}}>{t.name}</span>
                  {on && <div style={{position:'absolute',top:6,right:6,width:16,height:16,borderRadius:'50%',background:C.accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6 8 1" stroke={C.onAccent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{height:100}}/>
      </div>

      <div style={{padding:'12px 18px 30px',background:C.bg,borderTop:`1px solid ${C.lineSoft}`,flexShrink:0}}>
        <button onClick={()=>nav('room',{id:'r_new',name:name||'New Crew Room',team:'bears',members:1,unread:0,live:false,here:[]})}
          style={{width:'100%',padding:'15px',borderRadius:14,background:C.accent,border:'none',color:C.onAccent,fontSize:16,fontWeight:800,cursor:'pointer',fontFamily:FONT,letterSpacing:'-0.3px'}}>
          Create room
        </button>
      </div>
    </div>
  );
}

/* ════════════════ ONBOARDING ════════════════ */
function Onboarding({ onDone }){
  const [step,setStep]=React.useState(0);
  const [picked,setPicked]=React.useState([]);
  const teams=Object.values(TEAMS);
  const toggle=id=>setPicked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const screens=[
    <div key="0" style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'0 28px',gap:26,animation:'rise .5s ease'}}>
      <div>
        <div style={{fontSize:34,fontWeight:800,color:C.text,letterSpacing:'-1px',lineHeight:1.05}}>Where your<br/>crew watches<br/>the game.</div>
        <p style={{fontSize:15.5,color:C.text2,lineHeight:1.6,marginTop:16}}>See which friends are huddled up right now. Jump into their room. Talk through the game with the people you actually want to.</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {[['See who\'s live','Your friends, in rooms, right now'],['Rooms for the game','Group chat built for watching together'],['Bears Bot keeps up','Scores, news & market lines — in the thread']].map(([t,d],i)=>(
          <div key={i} style={{display:'flex',gap:12,alignItems:'center',background:C.elev,border:`1px solid ${C.line}`,borderRadius:12,padding:'13px 14px'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:C.accent,flexShrink:0}}/>
            <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{t}</div><div style={{fontSize:12,color:C.text3,marginTop:1}}>{d}</div></div>
          </div>
        ))}
      </div>
      <button onClick={()=>setStep(1)} style={{width:'100%',padding:'15px',borderRadius:14,background:C.accent,border:'none',color:C.onAccent,fontSize:16,fontWeight:800,cursor:'pointer',fontFamily:FONT}}>Get started →</button>
    </div>,

    <div key="1" style={{height:'100%',display:'flex',flexDirection:'column',padding:'64px 22px 24px',gap:18,animation:'rise .4s ease'}}>
      <div>
        <div style={{fontSize:11.5,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.text3,marginBottom:8}}>Step 1 of 2</div>
        <div style={{fontSize:25,fontWeight:800,color:C.text,letterSpacing:'-0.5px'}}>Pick your teams</div>
        <p style={{fontSize:13.5,color:C.text2,marginTop:6}}>They'll feed your Super Huddle.</p>
      </div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:9}}>
        {teams.map(t=>{const on=picked.includes(t.id);return(
          <button key={t.id} onClick={()=>toggle(t.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 12px',borderRadius:13,cursor:'pointer',fontFamily:FONT,
            background:on?C.accentDim:C.elev,border:`1.5px solid ${on?C.accent:C.line}`}}>
            <TeamMark teamId={t.id} size={40} radius={11}/>
            <div style={{flex:1,textAlign:'left'}}><div style={{fontSize:14.5,fontWeight:700,color:C.text}}>{t.name}</div><div style={{fontSize:11.5,color:C.text3}}>{t.league}</div></div>
            <div style={{width:24,height:24,borderRadius:'50%',background:on?C.accent:'transparent',border:`1.5px solid ${on?C.accent:C.line}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {on&&<svg width="11" height="8" viewBox="0 0 11 8"><path d="M1 4l3 3 6-6" stroke={C.onAccent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </button>
        );})}
      </div>
      <button onClick={()=>setStep(2)} disabled={!picked.length} style={{width:'100%',padding:'15px',borderRadius:14,border:'none',fontFamily:FONT,fontSize:16,fontWeight:800,cursor:picked.length?'pointer':'default',
        background:picked.length?C.accent:C.surface,color:picked.length?C.onAccent:C.text3}}>{picked.length?`Follow ${picked.length} team${picked.length>1?'s':''} →`:'Pick a team'}</button>
    </div>,

    <div key="2" style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'0 28px',gap:24,animation:'rise .5s ease',textAlign:'center'}}>
      <div style={{display:'flex',justifyContent:'center'}}>
        <div style={{display:'flex'}}>{['Ty','Mike D','Dan'].map((n,i)=><div key={i} style={{marginLeft:i?-12:0,borderRadius:'50%',boxShadow:`0 0 0 3px ${C.bg}`}}><Avatar name={n} size={52}/></div>)}</div>
      </div>
      <div>
        <div style={{fontSize:25,fontWeight:800,color:C.text,letterSpacing:'-0.5px'}}>You're in.</div>
        <p style={{fontSize:14.5,color:C.text2,lineHeight:1.6,marginTop:8}}>Three friends are already in rooms. Jump in and say what's up.</p>
      </div>
      <button onClick={onDone} style={{width:'100%',padding:'15px',borderRadius:14,background:C.accent,border:'none',color:C.onAccent,fontSize:16,fontWeight:800,cursor:'pointer',fontFamily:FONT}}>Go to Side Huddle →</button>
    </div>,
  ];

  return (
    <div style={{height:'100%',background:C.bg,position:'relative'}}>
      {step>0 && <div style={{position:'absolute',top:24,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6,zIndex:10}}>
        {[1,2].map(i=><div key={i} style={{width:i<=step?22:6,height:6,borderRadius:3,background:i<=step?C.accent:C.surface2,transition:'.3s'}}/>)}
      </div>}
      {screens[step]}
    </div>
  );
}

/* ════════════════ BOTTOM NAV ════════════════ */
function BottomNav({ active, nav }){
  const items=[
    {id:'home',label:'Home',icon:(c)=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11l9-8 9 8M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>},
    {id:'picks',label:'Picks',icon:(c)=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth="1.8"/><circle cx="12" cy="12" r="4" stroke={c} strokeWidth="1.8"/><circle cx="12" cy="12" r="0.5" stroke={c} strokeWidth="2"/></svg>},
    {id:'me',label:'Me',icon:(c)=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke={c} strokeWidth="1.8"/><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>},
  ];
  return (
    <div style={{display:'flex',justifyContent:'space-around',alignItems:'center',padding:'9px 0 26px',background:C.elev,borderTop:`1px solid ${C.line}`,flexShrink:0}}>
      {items.map(it=>{const a=active===it.id;const c=a?C.accent:C.text3;return(
        <button key={it.id} onClick={()=>nav(it.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',padding:'2px 18px'}}>
          {it.icon(c)}
          <span style={{fontSize:10,fontWeight:700,color:c,letterSpacing:'0.02em'}}>{it.label}</span>
        </button>
      );})}
    </div>
  );
}

Object.assign(window, { Home, SuperHuddle, MyRooms, Room, WhoSheet, CreateRoom, Onboarding, BottomNav });
