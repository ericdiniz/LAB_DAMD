const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const axios = require('axios');

const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

const PORT = process.env.PORT || 3002;
const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan('dev')); app.use(express.json());

const db = new JsonDatabase(path.join(__dirname,'database'), 'products');

// seed
(async ()=>{
  if((await db.count())===0){
    await db.create({ id:uuidv4(), name:'Notebook Gamer', price:3499.99, stock:5, active:true, category:{name:'eletronicos',slug:'eletronicos'} });
    await db.create({ id:uuidv4(), name:'Fone Bluetooth', price:299.99, stock:20, active:true, category:{name:'acessorios',slug:'acessorios'} });
    console.log('📦 produtos seeds criados');
  }
})();

app.get('/health', async (req,res)=> res.json({ service:'product-service', status:'healthy', products: await db.count() }));
app.get('/', (req,res)=> res.json({ service:'product-service', endpoints:['GET /products','POST /products'] }));

// middleware de auth validando no user-service
async function auth(req,res,next){
  const h = req.header('Authorization')||'';
  if(!h.startsWith('Bearer ')) return res.status(401).json({success:false,message:'token ausente'});
  try{
    const user = registry.discover('user-service');
    const r = await axios.post(`${user.url}/auth/validate`, { token: h.replace('Bearer ','') }, { timeout:4000, family:4 });
    if(r.data?.success){ req.user = r.data.data.user; return next(); }
    return res.status(401).json({success:false,message:'token inválido'});
  }catch(e){ return res.status(503).json({success:false,message:'auth indisponível'}); }
}

// CRUD básico
app.get('/products', async (req,res)=>{
  const { page=1, limit=10, category } = req.query;
  const skip = (parseInt(page)-1)*parseInt(limit);
  const filter = { active:true };
  if(category) filter['category.slug']=category;
  const items = await db.find(filter, { skip, limit: parseInt(limit), sort:{ createdAt:-1 } });
  res.json({ success:true, data:items, pagination:{ page:parseInt(page), limit:parseInt(limit) } });
});

app.post('/products', auth, async (req,res)=>{
  const { name, price, stock=0, category } = req.body;
  if(!name || price==null) return res.status(400).json({success:false,message:'nome e preço obrigatórios'});
  const p = await db.create({ id:uuidv4(), name, price:parseFloat(price), stock:parseInt(stock), active:true, category: category||{name:'geral',slug:'geral'}, metadata:{ createdBy:req.user.id } });
  res.status(201).json({ success:true, data:p });
});

app.listen(PORT, ()=>{
  console.log(`📦 product-service na porta ${PORT}`);
  registry.register('product-service', { url:`http://127.0.0.1:${PORT}` });
});
