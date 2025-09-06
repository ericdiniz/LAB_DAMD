const clients=new Set();
module.exports={
  Chat(call){
    clients.add(call);
    call.on('data',(msg)=>{for(const c of clients){if(!c.cancelled)c.write({user:msg.user,text:msg.text,ts:Date.now()});}});
    call.on('end',()=>{clients.delete(call);call.end();});
    call.on('error',()=>{clients.delete(call);});
  }
}
