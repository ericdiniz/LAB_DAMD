const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
  constructor(dbPath, collection) {
    this.dbPath = dbPath;
    this.collection = collection;
    this.filePath = path.join(dbPath, `${collection}.json`);
    fs.ensureDirSync(dbPath);
    if(!fs.existsSync(this.filePath)) fs.writeJsonSync(this.filePath, []);
  }
  readAll(){ try{ return fs.readJsonSync(this.filePath);}catch{ return []; } }
  writeAll(docs){ fs.writeJsonSync(this.filePath, docs, { spaces:2 }); }
  async create(data){ const docs=this.readAll(); const doc={ id:data.id||uuidv4(), ...data, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }; docs.push(doc); this.writeAll(docs); return doc; }
  async findById(id){ return this.readAll().find(d=>d.id===id)||null; }
  async find(filter={}, {skip=0, limit=999999, sort}={}) {
    let docs=this.readAll();
    if(Object.keys(filter).length){
      docs = docs.filter(d=> Object.entries(filter).every(([k,v])=>{
        const val = k.split('.').reduce((o,kk)=>o?.[kk], d);
        if(v && typeof v==='object'){
          if('$gte' in v && !(val>=v.$gte)) return false;
          if('$lte' in v && !(val<=v.$lte)) return false;
          if('$in' in v && !v.$in.includes(val)) return false;
          return true;
        }
        return val===v;
      }));
    }
    if(sort){
      const [[field,dir]] = Object.entries(sort);
      docs.sort((a,b)=> (a[field]>b[field]?1:-1) * (dir===-1?-1:1));
    }
    return docs.slice(skip, skip+limit);
  }
  async count(filter={}){ return (await this.find(filter)).length; }
  async update(id, updates){
    const docs=this.readAll(); const i=docs.findIndex(d=>d.id===id); if(i===-1) return null;
    const cur=docs[i]; const next={...cur, ...updates, id:cur.id, createdAt:cur.createdAt, updatedAt:new Date().toISOString()};
    docs[i]=next; this.writeAll(docs); return next;
  }
  async delete(id){ const docs=this.readAll(); const i=docs.findIndex(d=>d.id===id); if(i===-1) return false; docs.splice(i,1); this.writeAll(docs); return true; }
  async search(q, fields=[]){
    const term = String(q).toLowerCase();
    return this.readAll().filter(doc=>{
      const check = (v)=> typeof v==='string' && v.toLowerCase().includes(term);
      if(fields.length) return fields.some(f=>{ const v=f.split('.').reduce((o,k)=>o?.[k],doc); return v && check(v); });
      return Object.values(doc).some(v=> (typeof v==='string' && check(v)) || (v && typeof v==='object' && Object.values(v).some(x=> typeof x==='string' && check(x))));
    });
  }
}
module.exports = JsonDatabase;
