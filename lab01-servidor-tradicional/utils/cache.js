class Cache {
  constructor(){ this.store = new Map(); }
  key(k){ return JSON.stringify(k); }
  get(k){
    const kk = this.key(k);
    const v = this.store.get(kk);
    if (!v) return null;
    if (v.exp && v.exp < Date.now()) { this.store.delete(kk); return null; }
    return v.val;
  }
  set(k, val, ttlMs = 60000){
    const kk = this.key(k);
    const exp = ttlMs ? Date.now() + ttlMs : 0;
    this.store.set(kk, { val, exp });
  }
  delStartsWith(prefix){
    const p = this.key(prefix).slice(0, -1);
    for (const k of this.store.keys()){
      if (k.startsWith(p)) this.store.delete(k);
    }
  }
}
module.exports = new Cache();
