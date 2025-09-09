const fs = require('fs');
const path = require('path');
const axios = require('axios');

class FileRegistry {
  constructor(){
    this.registryFile = path.join(__dirname, 'services-registry.json');
    if(!fs.existsSync(this.registryFile)) fs.writeFileSync(this.registryFile, '{}');
  }
  read(){ try{ return JSON.parse(fs.readFileSync(this.registryFile,'utf8')); }catch{ return {}; } }
  write(obj){ fs.writeFileSync(this.registryFile, JSON.stringify(obj,null,2)); }
  register(name, info){ const s=this.read(); s[name]={...info, healthy:true, registeredAt:Date.now(), pid:process.pid}; this.write(s); }
  unregister(name){ const s=this.read(); delete s[name]; this.write(s); }
  discover(name){ const s=this.read(); if(!s[name]) throw new Error(`Serviço não encontrado: ${name}`); if(!s[name].healthy) throw new Error(`Serviço indisponível: ${name}`); return s[name]; }
  listServices(){ const s=this.read(); const out={}; Object.entries(s).forEach(([n,i])=> out[n]={url:i.url, healthy:i.healthy, pid:i.pid}); return out; }
  updateHealth(name, healthy){ const s=this.read(); if(s[name]){ s[name].healthy=healthy; s[name].lastHealthCheck=Date.now(); this.write(s);} }
  async performHealthChecks(){
    const s=this.read();
    for(const [name,info] of Object.entries(s)){
      try{ await axios.get(`${info.url}/health`, {timeout:4000, family:4}); this.updateHealth(name,true); }
      catch{ this.updateHealth(name,false); }
    }
  }
}
const registry = new FileRegistry();
process.on('exit', ()=> registry.unregister && null);
module.exports = registry;
