import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, Clock3, FileText, Inbox, LayoutDashboard, Send, ShieldCheck, Users, X } from "lucide-react";
import "./styles.css";

type Role = "Reporter" | "Editor" | "Desk Head";
type Item = { id:number; source:string; headline:string; body:string; received_at:string; story_id:number|null };
type Story = { id:number; title:string; subject:string; brief:string; status:string; created_at:string; published_at:string|null; sources:string[]; item_count:number; turnaround_minutes:number|null };

const fmt = (d:string|null) => d ? new Date(d).toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "—";

async function api(path:string, options?:RequestInit) {
  const r = await fetch(path, {headers:{"Content-Type":"application/json"}, ...options});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function App() {
  const [role,setRole] = useState<Role>("Reporter");
  const [tab,setTab] = useState("inbox");
  const [items,setItems] = useState<Item[]>([]);
  const [stories,setStories] = useState<Story[]>([]);
  const [selected,setSelected] = useState<Story|null>(null);
  const [brief,setBrief] = useState("");
  const [notice,setNotice] = useState("");

  const load = async() => {
    const [i,s] = await Promise.all([api("/api/items"),api("/api/stories")]);
    setItems(i); setStories(s);
    if (selected) setSelected(s.find((x:Story)=>x.id===selected.id) || null);
  };
  useEffect(()=>{load()},[]);

  const grouped = useMemo(()=>stories.filter(s=>s.status!=="published"),[stories]);
  const published = stories.filter(s=>s.status==="published");

  const generate = async(itemId:number) => {
    const s = await api("/api/stories/generate",{method:"POST",body:JSON.stringify({itemId})});
    await load(); setSelected(s); setBrief(s.brief); setTab("stories");
  };

  const save = async() => {
    if(!selected) return;
    const s = await api(`/api/stories/${selected.id}`,{method:"PUT",body:JSON.stringify({brief})});
    setSelected(s); await load(); setNotice("Draft saved");
  };

  const submit = async() => {
    if(!selected) return;
    const s = await api(`/api/stories/${selected.id}/submit`,{method:"POST"});
    setSelected(s); await load(); setNotice("Sent to editor");
  };

  const publish = async() => {
    if(!selected) return;
    try {
      const s = await api(`/api/stories/${selected.id}/publish`,{method:"POST"});
      setSelected(s); await load(); setNotice("Published successfully");
    } catch(e:any) { setNotice(e.message); }
  };

  const nav = [
    {id:"inbox",label:"Incoming",icon:Inbox},
    {id:"stories",label:"Story Desk",icon:FileText},
    {id:"published",label:"Published",icon:Send},
    {id:"dashboard",label:"Desk Head",icon:LayoutDashboard}
  ];

  return <div className="app">
    <aside>
      <div className="brand"><div className="mark">N</div><div><b>News Brief Desk</b><small>Editorial workspace</small></div></div>
      <div className="rolebox"><span>Current role</span><select value={role} onChange={e=>setRole(e.target.value as Role)}><option>Reporter</option><option>Editor</option><option>Desk Head</option></select></div>
      <nav>{nav.map(n=>{const Icon=n.icon; return <button className={tab===n.id?"active":""} onClick={()=>setTab(n.id)} key={n.id}><Icon size={18}/>{n.label}</button>})}</nav>
      <div className="sidefoot"><ShieldCheck size={16}/> Role-based publishing controls enabled</div>
    </aside>
    <main>
      <header><div><h1>{tab==="inbox"?"Incoming pile":tab==="stories"?"Story desk":tab==="published"?"Published stories":"Desk head dashboard"}</h1><p>One checked brief per real story.</p></div><div className="pill"><Users size={15}/>{role}</div></header>
      {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}

      {tab==="inbox" && <section>
        <div className="stats"><Stat icon={<Inbox/>} label="Raw items" value={items.length}/><Stat icon={<FileText/>} label="Story groups" value={stories.length}/><Stat icon={<CheckCircle2/>} label="Published" value={published.length}/></div>
        <div className="sectionhead"><div><h2>Incoming items</h2><p>AI grouping highlights likely duplicates before a reporter drafts.</p></div></div>
        <div className="grid">{items.map(i=><article className="card" key={i.id}><div className="meta">{i.source} · {fmt(i.received_at)}</div><h3>{i.headline}</h3><p>{i.body}</p><div className="cardfoot">{i.story_id?<span className="tag">Grouped into Story #{i.story_id}</span>:<span className="tag muted">Unassigned</span>}<button className="primary" onClick={()=>generate(i.id)}>Draft brief</button></div></article>)}</div>
      </section>}

      {tab==="stories" && <section className="split">
        <div><div className="sectionhead"><div><h2>Story groups</h2><p>Grouped by event, with sources retained.</p></div></div>
        <div className="list">{grouped.map(s=><button className={"storyrow "+(selected?.id===s.id?"selected":"")} onClick={()=>{setSelected(s);setBrief(s.brief)}} key={s.id}><div><b>{s.title}</b><span>{s.item_count} sources · {s.subject}</span></div><Status s={s.status}/></button>)}</div></div>
        {selected && <EditorPanel s={selected} brief={brief} setBrief={setBrief} role={role} save={save} submit={submit} publish={publish}/>}
      </section>}

      {tab==="published" && <section><div className="sectionhead"><div><h2>Published</h2><p>Published briefs are locked in this prototype.</p></div></div><div className="list">{published.map(s=><div className="storyrow" key={s.id}><div><b>{s.title}</b><span>{s.subject} · Published {fmt(s.published_at)}</span></div><Status s={s.status}/></div>)}</div></section>}

      {tab==="dashboard" && <Dashboard stories={stories}/>}
    </main>
  </div>
}

function Stat({icon,label,value}:{icon:any,label:string,value:any}) {return <div className="stat">{icon}<div><b>{value}</b><span>{label}</span></div></div>}
function Status({s}:{s:string}) {return <span className={"status "+s.replaceAll("_","-")}>{s.replaceAll("_"," ")}</span>}
function EditorPanel({s,brief,setBrief,role,save,submit,publish}:{s:Story,brief:string,setBrief:(v:string)=>void,role:Role,save:()=>void,submit:()=>void,publish:()=>void}) {
  return <div className="panel"><div className="paneltop"><div><span className="eyebrow">Story #{s.id}</span><h2>{s.title}</h2></div><Status s={s.status}/></div><label>Brief</label><textarea value={brief} disabled={s.status==="published"} onChange={e=>setBrief(e.target.value)}/><div className="sources"><b>Sources</b>{s.sources.map(x=><span key={x}>{x}</span>)}</div>{s.status!=="published"&&<div className="actions">{role!=="Desk Head"&&<button onClick={save}>Save draft</button>}{role==="Reporter"&&s.status==="draft"&&<button className="primary" onClick={submit}>Submit to editor</button>}{role==="Editor"&&s.status==="submitted"&&<button className="primary" onClick={publish}>Approve & publish</button>}{role==="Reporter"&&s.status==="submitted"&&<span className="hint">Waiting for editor approval.</span>}</div>}{s.status==="published"&&<div className="locked"><CheckCircle2/> Published and locked</div>}</div>
}
function Dashboard({stories}:{stories:Story[]}) {
  const pub=stories.filter(s=>s.status==="published");
  const avg=pub.length?Math.round(pub.reduce((a,s)=>a+(s.turnaround_minutes||0),0)/pub.length):0;
  const subjects=[...new Set(pub.map(s=>s.subject))];
  return <section><div className="stats"><Stat icon={<Send/>} label="Published yesterday" value={pub.length}/><Stat icon={<Clock3/>} label="Avg turnaround" value={`${avg}m`}/><Stat icon={<FileText/>} label="Subjects" value={subjects.length}/></div><div className="dashboardgrid"><div className="card"><h2>Published subjects</h2>{subjects.length?subjects.map(x=><div className="metric" key={x}><span>{x}</span><b>{pub.filter(s=>s.subject===x).length}</b></div>):<p>No published stories yet.</p>}</div><div className="card"><h2>Publication log</h2>{pub.map(s=><div className="metric" key={s.id}><span>{s.title}<small>{fmt(s.published_at)}</small></span><b>{s.turnaround_minutes}m</b></div>)}</div></div></section>
}
createRoot(document.getElementById("root")!).render(<App/>);
