import express from "express";
import Database from "better-sqlite3";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
const db = new Database(path.join(__dirname,"news.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS items(
 id INTEGER PRIMARY KEY,
 source TEXT NOT NULL,
 headline TEXT NOT NULL,
 body TEXT NOT NULL,
 received_at TEXT NOT NULL,
 story_id INTEGER
);
CREATE TABLE IF NOT EXISTS stories(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 subject TEXT NOT NULL,
 brief TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft',
 created_at TEXT NOT NULL,
 published_at TEXT,
 sources TEXT NOT NULL,
 item_count INTEGER NOT NULL DEFAULT 0,
 turnaround_minutes INTEGER
);
`);

const count = db.prepare("SELECT COUNT(*) c FROM items").get().c;
if(count===0){
 const now=Date.now();
 const iso=(m)=>new Date(now-m*60000).toISOString();
 const seed=[
 {source:"Harbor Wire",headline:"Fire breaks out at Port Azure chemical plant; nearby road closed",body:"A blaze erupted at the North Quay chemical plant in Port Azure shortly after dawn. Emergency crews closed Dock Road as smoke drifted over the industrial district. No injuries were immediately reported.",m:95,g:1},
 {source:"Coastal Ledger",headline:"Port Azure crews battle North Quay factory blaze",body:"Firefighters were sent to a large industrial fire at North Quay on Tuesday morning, with authorities restricting access along Dock Road. Officials said the incident was being contained and had not reported casualties.",m:90,g:1},
 {source:"Metro Press",headline:"Smoke seen over Port Azure as chemical facility catches fire",body:"Residents reported a heavy plume above the North Quay industrial area after a fire started inside a chemical facility. The city said emergency teams were on scene and asked motorists to avoid the area.",m:82,g:1},
 {source:"City Bulletin",headline:"Warehouse fire closes Dock Road in Eastport",body:"A warehouse fire in Eastport's riverside district forced a temporary closure of Dock Road on Wednesday evening. The building was evacuated and crews said the blaze was under control.",m:78,g:2},
 {source:"Morning Journal",headline:"Dock Road reopened after Port Azure plant incident",body:"Authorities reopened Dock Road in Port Azure after a small fire at a packaging unit was extinguished. The separate incident occurred two days after a larger North Quay chemical plant blaze.",m:70,g:3},
 {source:"Market Desk",headline:"Orion Foods raises full-year revenue outlook after strong quarter",body:"Orion Foods lifted its revenue forecast after reporting stronger-than-expected quarterly sales, citing growth in its packaged foods division.",m:64,g:4},
 {source:"Civic News",headline:"Riverton council approves new night-bus network",body:"Riverton councillors voted to approve a pilot night-bus network beginning next month, with five routes planned for the first phase.",m:58,g:5},
 {source:"Tech Ledger",headline:"Nexa Systems unveils battery backup for regional data centres",body:"Nexa Systems announced a new battery backup product aimed at reducing downtime at regional data centres. The company said installations will begin with three pilot customers.",m:51,g:6},
 {source:"State Wire",headline:"Coastal storm watch expanded as winds strengthen offshore",body:"Weather officials expanded a coastal storm watch after wind speeds increased offshore. Residents in low-lying areas were advised to review local emergency guidance.",m:44,g:7}
 ];
 const ins=db.prepare("INSERT INTO items(source,headline,body,received_at,story_id) VALUES(?,?,?,?,?)");
 const tx=db.transaction(()=>seed.forEach(x=>ins.run(x.source,x.headline,x.body,iso(x.m),null)));
 tx();
}

const groupSeeds=[
 {g:1,title:"Fire breaks out at Port Azure chemical plant",subject:"Local emergency",brief:"A fire broke out at the North Quay chemical plant in Port Azure, prompting emergency crews to close Dock Road as smoke spread across the industrial area. Authorities said no injuries had been reported in initial updates.",status:"draft"},
 {g:2,title:"Warehouse fire closes Dock Road in Eastport",subject:"Local emergency",brief:"A warehouse fire in Eastport temporarily closed Dock Road on Wednesday evening. The building was evacuated and firefighters said the blaze was under control.",status:"draft"},
 {g:3,title:"Separate Port Azure packaging-unit fire extinguished",subject:"Local emergency",brief:"A small fire at a Port Azure packaging unit was extinguished and Dock Road was reopened. Authorities described it as a separate incident from the earlier North Quay chemical-plant fire.",status:"draft"},
 {g:4,title:"Orion Foods raises full-year revenue outlook",subject:"Business",brief:"Orion Foods raised its full-year revenue outlook after reporting stronger-than-expected quarterly sales, citing growth in packaged foods.",status:"draft"},
 {g:5,title:"Riverton approves pilot night-bus network",subject:"Transport",brief:"Riverton council approved a pilot night-bus network with five routes planned to begin next month.",status:"draft"},
 {g:6,title:"Nexa Systems unveils data-centre battery backup",subject:"Technology",brief:"Nexa Systems unveiled a battery backup product for regional data centres and said installations will begin with three pilot customers.",status:"draft"},
 {g:7,title:"Coastal storm watch expanded",subject:"Weather",brief:"Weather officials expanded a coastal storm watch as winds strengthened offshore and advised residents in low-lying areas to review emergency guidance.",status:"draft"}
];

function ensureGroups(){
 for(const g of groupSeeds){
   const existing=db.prepare("SELECT id FROM stories WHERE title=?").get(g.title);
   if(existing) continue;
   const items=db.prepare("SELECT * FROM items WHERE headline LIKE ?").all(g.g===1?"%Port Azure%chemical%":g.g===2?"%Warehouse fire%":g.g===3?"%packaging%":g.g===4?"%Orion Foods%":g.g===5?"%Riverton council%":g.g===6?"%Nexa Systems%":"%storm watch%");
   const sourceList=items.map(x=>x.source);
   const first=items[0]?.received_at || new Date().toISOString();
   const info=db.prepare(`INSERT INTO stories(title,subject,brief,status,created_at,sources,item_count) VALUES(?,?,?,?,?,?,?)`).run(g.title,g.subject,g.brief,g.status,first,JSON.stringify(sourceList),items.length);
   if(g.g===1){
     db.prepare("UPDATE items SET story_id=? WHERE id IN (1,2,3)").run(info.lastInsertRowid);
   } else {
     if(items.length) db.prepare("UPDATE items SET story_id=? WHERE id=?").run(info.lastInsertRowid,items[0].id);
   }
 }
}
ensureGroups();

app.get("/api/items",(req,res)=>{
 const rows=db.prepare("SELECT * FROM items ORDER BY received_at DESC").all();
 res.json(rows);
});
app.get("/api/stories",(req,res)=>{
 const rows=db.prepare("SELECT * FROM stories ORDER BY id DESC").all().map(x=>({...x,sources:JSON.parse(x.sources)}));
 res.json(rows);
});

app.post("/api/stories/generate",async(req,res)=>{
 const item=db.prepare("SELECT * FROM items WHERE id=?").get(req.body.itemId);
 if(!item) return res.status(404).send("Item not found");
 if(item.story_id){ return res.json({...db.prepare("SELECT * FROM stories WHERE id=?").get(item.story_id),sources:JSON.parse(db.prepare("SELECT sources FROM stories WHERE id=?").get(item.story_id).sources)})}
 const story=db.prepare("INSERT INTO stories(title,subject,brief,status,created_at,sources,item_count) VALUES(?,?,?,?,?,?,?)").run(item.headline,item.source,"", "draft",item.received_at,JSON.stringify([item.source]),1);
 db.prepare("UPDATE items SET story_id=? WHERE id=?").run(story.lastInsertRowid,item.id);
 const s=db.prepare("SELECT * FROM stories WHERE id=?").get(story.lastInsertRowid);
 res.json({...s,sources:JSON.parse(s.sources)});
});

app.put("/api/stories/:id",(req,res)=>{
 const s=db.prepare("SELECT * FROM stories WHERE id=?").get(req.params.id);
 if(!s) return res.status(404).send("Story not found");
 if(s.status==="published") return res.status(409).send("Published stories are locked.");
 db.prepare("UPDATE stories SET brief=? WHERE id=?").run(req.body.brief,s.id);
 const x=db.prepare("SELECT * FROM stories WHERE id=?").get(s.id);
 res.json({...x,sources:JSON.parse(x.sources)});
});
app.post("/api/stories/:id/submit",(req,res)=>{
 const s=db.prepare("SELECT * FROM stories WHERE id=?").get(req.params.id);
 if(!s||s.status!=="draft") return res.status(409).send("Only draft stories can be submitted.");
 db.prepare("UPDATE stories SET status='submitted' WHERE id=?").run(s.id);
 const x=db.prepare("SELECT * FROM stories WHERE id=?").get(s.id);
 res.json({...x,sources:JSON.parse(x.sources)});
});
app.post("/api/stories/:id/publish",(req,res)=>{
 const s=db.prepare("SELECT * FROM stories WHERE id=?").get(req.params.id);
 if(!s||s.status!=="submitted") return res.status(403).send("Only submitted stories can be published by an editor.");
 const pub=new Date().toISOString();
 const minutes=Math.max(1,Math.round((new Date(pub)-new Date(s.created_at))/60000));
 db.prepare("UPDATE stories SET status='published',published_at=?,turnaround_minutes=? WHERE id=?").run(pub,minutes,s.id);
 const x=db.prepare("SELECT * FROM stories WHERE id=?").get(s.id);
 res.json({...x,sources:JSON.parse(x.sources)});
});

const port=4000;
app.listen(port,()=>console.log(`API running on http://localhost:${port}`));
