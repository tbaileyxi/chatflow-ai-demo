/* ─────────────────────────────────────────────────────────────
   SIDE HUDDLE v5 — UI primitives (babel)
   ───────────────────────────────────────────────────────────── */
const { C, FONT, MONO, person, initials, TEAMS } = window.SH;

// ── LIVE dot ──
function Dot({ color=C.live, size=6, pulse=true }){
  return <div style={{width:size,height:size,borderRadius:'50%',background:color,flexShrink:0,animation:pulse?'pulse 1.6s infinite':'none'}}/>;
}

// ── Person avatar — initials monogram on a muted tint ──
function Avatar({ name, size=34, ring }){
  const p = person(name||'?');
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:p.bg,border:`1px solid ${p.line}`,
      boxShadow:ring?`0 0 0 2px ${ring}`:'none',
      display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
      color:p.fg,fontFamily:FONT,fontWeight:700,fontSize:size*0.36,letterSpacing:'0.02em'}}>
      {initials(name||'?')}
    </div>
  );
}

// ── Team tile — abbreviation on team color ──
function TeamMark({ teamId, size=34, radius }){
  const t = TEAMS[teamId] || { color:'#222', abbr:'?', ink:'#fff' };
  return (
    <div style={{width:size,height:size,borderRadius:radius!=null?radius:'50%',background:t.color,
      border:`1px solid rgba(255,255,255,0.1)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
      fontFamily:MONO,fontWeight:600,fontSize:size*0.3,letterSpacing:'-0.02em',color:'#fff',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:t.ink}}/>
      {t.abbr}
    </div>
  );
}

// ── Bot byline — team name + "Bot" (no Side Huddle branding) ──
function BotByline({ teamId, time, label }){
  const t = TEAMS[teamId] || {};
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
      <TeamMark teamId={teamId} size={22} radius={6}/>
      <span style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',flexShrink:0}}>{t.name? t.name.split(' ').slice(-1)[0] : 'Team'} Bot</span>
      {label && <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.09em',textTransform:'uppercase',color:C.text3,
        border:`1px solid ${C.line}`,borderRadius:4,padding:'1px 5px'}}>{label}</span>}
      <span style={{fontSize:11.5,color:C.text3,marginLeft:'auto'}}>{time}</span>
    </div>
  );
}

// ── Stacked avatars (people) ──
function Stack({ names, size=24, max=4, ring=C.bg }){
  const shown=(names||[]).slice(0,max);
  const extra=(names||[]).length-shown.length;
  return (
    <div style={{display:'flex',alignItems:'center'}}>
      {shown.map((n,i)=>(
        <div key={i} style={{marginLeft:i?-size*0.34:0,borderRadius:'50%',boxShadow:`0 0 0 2px ${ring}`,zIndex:max-i}}>
          <Avatar name={n} size={size}/>
        </div>
      ))}
      {extra>0 && <div style={{marginLeft:-size*0.34,width:size,height:size,borderRadius:'50%',background:C.surface2,
        border:`1px solid ${C.line}`,boxShadow:`0 0 0 2px ${ring}`,display:'flex',alignItems:'center',justifyContent:'center',
        fontFamily:MONO,fontSize:size*0.32,fontWeight:600,color:C.text2,zIndex:0}}>+{extra}</div>}
    </div>
  );
}

// ── Source tag (X / ESPN / Kalshi) ──
function SourceTag({ source }){
  const map={ ESPN:'#E64B4B', X:C.text2, Kalshi:C.info, market:C.info };
  const col=map[source]||C.text2;
  return <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:col,
    border:`1px solid ${col}40`,background:`${col}14`,borderRadius:4,padding:'1px 6px'}}>{source}</span>;
}

// ── Media placeholder (clip) ──
function Media({ tall }){
  const [play,setPlay]=React.useState(false);
  return (
    <div onClick={e=>{e.stopPropagation();setPlay(p=>!p);}} style={{position:'relative',width:'100%',aspectRatio:tall?'4/3':'16/9',
      background:'#0a0b0d',borderRadius:10,overflow:'hidden',marginTop:9,cursor:'pointer',border:`1px solid ${C.line}`}}>
      <div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(135deg,#101216 0,#101216 11px,#0c0d10 11px,#0c0d10 22px)'}}/>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
        <div style={{width:46,height:46,borderRadius:'50%',background:C.accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {play
            ? <div style={{display:'flex',gap:3}}><div style={{width:4.5,height:15,background:C.onAccent,borderRadius:1}}/><div style={{width:4.5,height:15,background:C.onAccent,borderRadius:1}}/></div>
            : <svg width="15" height="17" viewBox="0 0 15 17"><path d="M1 1l13 7.5L1 16V1z" fill={C.onAccent}/></svg>}
        </div>
        <span style={{fontSize:10,color:C.text3,fontFamily:MONO}}>{play?'playing…':'clip'}</span>
      </div>
    </div>
  );
}

// ─────────── BOT CARDS ───────────

function ScoreCard({ data }){
  const live = !/Tip|Final/i.test(data.state);
  return (
    <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'12px 14px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10}}>
        <div style={{textAlign:'left'}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{data.home}</div>
          <div style={{fontFamily:MONO,fontSize:30,fontWeight:600,color:C.text,lineHeight:1.05,marginTop:2}}>{data.homeScore}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'2px 8px',borderRadius:20,
            background:live?C.liveDim:C.surface2,border:`1px solid ${live?C.liveLine:C.line}`}}>
            {live && <Dot size={5}/>}
            <span style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.04em',color:live?C.live:C.text2}}>{data.state}</span>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:13,fontWeight:500,color:C.text2}}>{data.away}</div>
          <div style={{fontFamily:MONO,fontSize:30,fontWeight:600,color:C.text3,lineHeight:1.05,marginTop:2}}>{data.awayScore}</div>
        </div>
      </div>
      {data.note && <div style={{padding:'9px 14px',borderTop:`1px solid ${C.lineSoft}`,fontSize:12.5,color:C.text2,fontWeight:500}}>{data.note}</div>}
    </div>
  );
}

function PostCard({ data }){
  return (
    <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
        <span style={{fontSize:12.5,fontWeight:700,color:C.text}}>{data.handle}</span>
        <SourceTag source={data.source}/>
      </div>
      <p style={{fontSize:14,color:C.text,lineHeight:1.5}}>{data.text}</p>
      {data.media && <Media/>}
    </div>
  );
}

function NewsCard({ data }){
  return (
    <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'12px 14px'}}>
      <div style={{marginBottom:7}}><SourceTag source={data.source}/></div>
      <p style={{fontSize:14.5,fontWeight:600,color:C.text,lineHeight:1.45,letterSpacing:'-0.1px'}}>{data.headline}</p>
      {data.media && <Media/>}
    </div>
  );
}

function PredictionCard({ data, compact }){
  const [pick,setPick]=React.useState(null);
  const [yes,setYes]=React.useState(data.yes);
  const no=100-yes;
  const choose=s=>{
    if(pick===s) return;
    setYes(s==='yes'?Math.min(99,yes+1):Math.max(1,yes-1));
    setPick(s);
  };
  return (
    <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'9px 14px',borderBottom:`1px solid ${C.lineSoft}`,display:'flex',alignItems:'center',gap:8}}>
        <SourceTag source="Kalshi"/>
        <span style={{fontSize:10.5,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:C.text3}}>Prediction market</span>
        <span style={{fontSize:11.5,color:C.pos,fontWeight:700,marginLeft:'auto',fontFamily:MONO}}>{data.moved}</span>
      </div>
      <div style={{padding:'12px 14px'}}>
        <p style={{fontSize:14.5,fontWeight:600,color:C.text,marginBottom:12,lineHeight:1.35,letterSpacing:'-0.1px'}}>{data.question}</p>
        <div style={{display:'flex',height:5,borderRadius:4,overflow:'hidden',marginBottom:9}}>
          <div style={{flex:yes,background:C.pos,transition:'flex .4s'}}/>
          <div style={{flex:no,background:'#3a2e2e',transition:'flex .4s'}}/>
        </div>
        <div style={{display:'flex',gap:9}}>
          <button onClick={()=>choose('yes')} style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',fontFamily:FONT,
            background:pick==='yes'?'rgba(63,191,121,0.16)':C.surface2, border:`1px solid ${pick==='yes'?C.pos+'88':C.line}`,
            display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:pick==='yes'?C.pos:C.text}}>Yes</span>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.pos}}>{yes}¢</span>
          </button>
          <button onClick={()=>choose('no')} style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',fontFamily:FONT,
            background:pick==='no'?'rgba(240,89,76,0.14)':C.surface2, border:`1px solid ${pick==='no'?C.neg+'88':C.line}`,
            display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:pick==='no'?C.neg:C.text}}>No</span>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text2}}>{no}¢</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function BotBody({ kind, data }){
  if(kind==='score') return <ScoreCard data={data}/>;
  if(kind==='post')  return <PostCard data={data}/>;
  if(kind==='news')  return <NewsCard data={data}/>;
  if(kind==='pred')  return <PredictionCard data={data}/>;
  return null;
}

// ── Chat message bubble (no reactions; threaded replies kept) ──
function Bubble({ msg, showName, onReply }){
  if(msg.type==='system'){
    return <div style={{textAlign:'center',padding:'8px 16px'}}>
      <span style={{fontSize:11,color:C.text3,fontWeight:500}}>{msg.text}</span>
    </div>;
  }
  if(msg.type==='bot'){
    return <div style={{padding:'8px 14px',animation:'rise .25s ease'}}>
      <BotByline teamId={msg.team} time={msg.time} label={msg.kind==='pred'?'market':msg.kind}/>
      <BotBody kind={msg.kind} data={msg.data}/>
    </div>;
  }
  const mine=msg.mine;
  return (
    <div style={{padding:'3px 12px',animation:'rise .2s ease'}}>
      <div style={{display:'flex',gap:9,flexDirection:mine?'row-reverse':'row',alignItems:'flex-start'}}>
        <div style={{width:30,flexShrink:0,paddingTop:showName?20:0}}>
          {showName && <Avatar name={msg.from} size={30}/>}
        </div>
        <div style={{maxWidth:'82%',display:'flex',flexDirection:'column',alignItems:mine?'flex-end':'flex-start'}}>
          {showName && !mine && <div style={{display:'flex',gap:7,alignItems:'baseline',marginBottom:3,paddingLeft:2}}>
            <span style={{fontSize:12,fontWeight:700,color:C.text}}>{msg.from}</span>
            <span style={{fontSize:10.5,color:C.text3}}>{msg.time}</span>
          </div>}
          <div style={{background:mine?C.accent:C.surface,color:mine?C.onAccent:C.text,
            padding:'9px 13px',borderRadius:16,
            borderTopLeftRadius:!mine&&showName?5:16, borderTopRightRadius:mine&&showName?5:16,
            fontSize:14.5,lineHeight:1.42,fontWeight:mine?500:400,
            border:mine?'none':`1px solid ${C.line}`}}>
            {(msg.text||'').split(/(@\w+)/g).map((p,i)=>/^@\w+/.test(p)
              ? <span key={i} style={{color:mine?C.onAccent:C.accent,fontWeight:700}}>{p}</span>
              : <span key={i}>{p}</span>)}
          </div>
          {mine && showName && <span style={{fontSize:10.5,color:C.text3,marginTop:3,paddingRight:2}}>{msg.time}</span>}

          {/* threaded replies */}
          {msg.replies && msg.replies.length>0 && (
            <div style={{marginTop:7,width:'100%',display:'flex',flexDirection:'column',gap:7,
              paddingLeft:mine?0:10,paddingRight:mine?10:0,
              borderLeft:mine?'none':`2px solid ${C.lineSoft}`,borderRight:mine?`2px solid ${C.lineSoft}`:'none'}}>
              {msg.replies.map((r,i)=>(
                <div key={i} style={{display:'flex',gap:7,flexDirection:mine?'row-reverse':'row',alignItems:'flex-start'}}>
                  <Avatar name={r.from} size={20}/>
                  <p style={{fontSize:12.5,color:C.text2,lineHeight:1.4,textAlign:mine?'right':'left'}}>
                    <span style={{fontWeight:700,color:C.text,marginRight:5}}>{r.from}</span>{r.text}
                  </p>
                </div>
              ))}
            </div>
          )}
          <button onClick={()=>onReply&&onReply(msg)} style={{fontSize:11,color:C.text3,background:'none',border:'none',
            cursor:'pointer',marginTop:5,padding:0,fontFamily:FONT,alignSelf:mine?'flex-end':'flex-start'}}>Reply</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Dot, Avatar, TeamMark, BotByline, Stack, SourceTag, Media,
  ScoreCard, PostCard, NewsCard, PredictionCard, BotBody, Bubble,
});
