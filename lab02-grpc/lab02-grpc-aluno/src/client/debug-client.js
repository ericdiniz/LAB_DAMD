// src/client/debug-client.js
const GrpcClient = require('./client');

class DebugGrpcClient {
  constructor(serverAddress = 'localhost:50051') {
    this.serverAddress = serverAddress;
    this.enableLogging = true;
    this.reqId = 0;
    this.metrics = { totalRequests: 0, totalErrors: 0, calls: [], byMethod: {} };
    this.client = new GrpcClient(this.serverAddress);
  }

  log(msg, data) {
    if (!this.enableLogging) return;
    const t = new Date().toISOString();
    console.log(`[${t}] ${msg}`);
    if (data !== undefined) {
      try { console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2)); }
      catch { console.log(data); }
    }
  }

  _rec(method, duration, success) {
    this.metrics.totalRequests++;
    if (!success) this.metrics.totalErrors++;
    this.metrics.calls.push({ method, duration, success, ts: Date.now() });
    if (!this.metrics.byMethod[method]) this.metrics.byMethod[method] = { count: 0, errors: 0, totalTime: 0 };
    this.metrics.byMethod[method].count++;
    this.metrics.byMethod[method].totalTime += duration;
    if (!success) this.metrics.byMethod[method].errors++;
  }

  async _call(name, fn, ...args) {
    const id = ++this.reqId;
    this.log(`📤 [${id}] ${name}`, args[0]);
    const t0 = Date.now();
    try {
      const res = await fn(...args);
      const dt = Date.now() - t0;
      this.log(`✅ [${id}] ${name} - ${dt}ms`, res);
      this._rec(name, dt, true);
      return res;
    } catch (err) {
      const dt = Date.now() - t0;
      this.log(`❌ [${id}] ${name} - ${dt}ms`, { message: err?.message, code: err?.code });
      this._rec(name, dt, false);
      throw err;
    }
  }

  async initialize() { return this._call('initialize', this.client.initialize.bind(this.client)); }
  async register(p) { return this._call('register', this.client.register.bind(this.client), p); }
  async login(p, pw) {
    const arg = typeof p === 'object' ? p : { identifier: p, password: pw };
    return this._call('login', this.client.login.bind(this.client), arg);
  }
  async createTask(p) { return this._call('createTask', this.client.createTask.bind(this.client), p); }
  async getTasks(f) { return this._call('getTasks', this.client.getTasks.bind(this.client), f); }
  async updateTask(id, p) { return this._call('updateTask', this.client.updateTask.bind(this.client), id, p); }
  async deleteTask(id) { return this._call('deleteTask', this.client.deleteTask.bind(this.client), id); }
  async getStats() { return this._call('getStats', this.client.getStats.bind(this.client)); }

  streamTasks(filters = {}) {
    if (typeof this.client.streamTasks !== 'function') { this.log('ℹ️ streamTasks não implementado'); return { cancel() {} }; }
    this.log('🌊 streamTasks', filters);
    const s = this.client.streamTasks(filters);
    let n = 0; const mapP = ['LOW','MEDIUM','HIGH','URGENT'];
    s.on('data', t => { n++; this.log(`📋 streamTasks #${n}`, {id:t.id,title:t.title,priority:mapP[t.priority]}); });
    s.on('end', ()=> this.log(`🌊 streamTasks end ${n}`));
    s.on('error', e=> this.log('❌ streamTasks error', {message:e.message}));
    return s;
  }

  streamNotifications() {
    if (typeof this.client.streamNotifications !== 'function') { this.log('ℹ️ streamNotifications não implementado'); return { cancel() {} }; }
    this.log('🔔 streamNotifications');
    const s = this.client.streamNotifications();
    let n = 0; const tmap=['CREATED','UPDATED','DELETED','COMPLETED'];
    s.on('data', ev=>{n++; this.log(`🔔 notif #${n}`, {type:tmap[ev.type],message:ev.message});});
    s.on('end', ()=> this.log(`�� streamNotifications end ${n}`));
    s.on('error', e=> this.log('❌ streamNotifications error',{message:e.message}));
    return s;
  }

  printMetrics() {
    const tot=this.metrics.totalRequests||1, ok=tot-this.metrics.totalErrors;
    const avg=this.metrics.calls.reduce((a,c)=>a+c.duration,0)/(this.metrics.calls.length||1);
    console.log('\n�� MÉTRICAS DO CLIENTE');
    console.log(`Total: ${tot} | Erros: ${this.metrics.totalErrors} | Sucesso: ${(ok/tot*100).toFixed(2)}% | Tempo médio: ${avg.toFixed(2)}ms`);
    Object.entries(this.metrics.byMethod).forEach(([m,st])=>{
      const avgM=st.totalTime/(st.count||1); const succM=((st.count-st.errors)/(st.count||1))*100;
      console.log(` - ${m}: ${st.count} calls, ${avgM.toFixed(2)}ms avg, ${succM.toFixed(1)}% success`);
    });
  }
}

async function runDebug() {
  const dbg = new DebugGrpcClient();
  try {
    await dbg.initialize();
    const stamp=Date.now(); const email=`dbg_${stamp}@t.com`, user=`dbg_${stamp}`, pw='dbg123';
    try{ await dbg.register({email,username:user,password:pw,first_name:'Dbg',last_name:'User'});}catch{}
    await dbg.login({identifier:user,password:pw});
    const ids=[];
    for(let i=1;i<=2;i++){ const r=await dbg.createTask({title:`Task${i}`,description:'debug',priority:i%4}); if(r?.task?.id) ids.push(r.task.id); }
    await dbg.getTasks({page:1,limit:5}); await dbg.getStats();
    if(ids[0]) await dbg.updateTask(ids[0],{title:'Task Updated',completed:true});
    const st=dbg.streamTasks({}); setTimeout(()=>st.cancel(),1000);
    await new Promise(r=>setTimeout(r,1500));
    for(const id of ids) await dbg.deleteTask(id);
    dbg.printMetrics();
  } catch(e){ console.error('❌ Debug error:',e.message); }
}

if(require.main===module){ runDebug(); }
module.exports=DebugGrpcClient;
