import {db} from './db.js';
import {bad,randomId,variantId,validateCustomer} from './utils.js';
import {priceQuote,MIN_WHOLESALE} from './pricing.js';
const safeImage=v=>typeof v==='string'&&(!v||/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/productos\/[a-f0-9]{24}\.(?:png|jpg|webp)$/.test(v));
const format=p=>({id:p.id,name:p.name,category:p.category,description:p.description,image:p.image,tiers:p.tiers,active:p.active,sourceWholesale:p.source_wholesale,variants:p.variants});
export async function products(admin=false){const sql=db();const rows=admin?await sql`SELECT * FROM products WHERE deleted=false ORDER BY category,name`:await sql`SELECT * FROM products WHERE deleted=false AND active=true ORDER BY category,name`;const vs=await sql`SELECT id,product_id,model,stock FROM variants WHERE active=true ORDER BY model`;return rows.map(p=>format({...p,variants:vs.filter(v=>v.product_id===p.id).map(v=>admin?{id:v.id,model:v.model,stock:v.stock}:{id:v.id,model:v.model,available:v.stock>0})}));}

async function fetchQuoteData(sql,input,locking=false){
 // FOR UPDATE prevents concurrent orders from selling the same units.
 const ps=locking?await sql`SELECT * FROM products WHERE deleted=false AND active=true FOR SHARE`:await sql`SELECT * FROM products WHERE deleted=false AND active=true`;
 const vs=locking?await sql`SELECT * FROM variants WHERE active=true ORDER BY id FOR UPDATE`:await sql`SELECT * FROM variants WHERE active=true`;
 return priceQuote(input,ps,vs);
}
export async function quote(input){return fetchQuoteData(db(),{...input,preview:true});}
export async function createOrder(input){
 const person=validateCustomer(input);if(input.method!=='whatsapp')throw bad('Solo se permiten pedidos por WhatsApp');const sql=db();
 return sql.begin(async tx=>{
  const q=await fetchQuoteData(tx,input,true);const id=randomId('CL'),now=new Date().toISOString();
  for(const l of q.lines){const r=await tx`UPDATE variants SET stock=stock-${l.qty} WHERE id=${l.variantId} AND stock>=${l.qty} RETURNING id`;if(r.length!==1)throw bad('Stock insuficiente');await tx`INSERT INTO inventory_moves(variant_id,delta,reason,order_id,created_at) VALUES(${l.variantId},${-l.qty},'reserva',${id},${now})`}
  await tx`INSERT INTO orders(id,created_at,updated_at,customer,phone,address,notes,mode,method,status,total,items,first_name,last_name,dni,city,postal_code,email)
   VALUES(${id},${now},${now},${person.customer},${person.phone},${person.address},${String(input.notes||'').slice(0,600)},'mayorista','whatsapp','pendiente',${q.total},${tx.json(q.lines)},${person.firstName},${person.lastName},${person.dni},${person.city},${person.postalCode},${person.email})`;
  return {id,...q,status:'pendiente',method:'whatsapp',customer:person.customer,phone:person.phone};
 });
}
export async function changeStatus(id,status){const allowed=['pendiente','confirmado','en_preparacion','enviado','entregado','cancelado'];if(!allowed.includes(status))throw bad('Estado inválido');const sql=db();return sql.begin(async tx=>{const r=await tx`SELECT * FROM orders WHERE id=${id} FOR UPDATE`;if(!r.length)throw bad('Pedido inexistente',404);const order=r[0];if(order.status===status)return {status};if(order.status==='cancelado')throw bad('Pedido ya cancelado');if(status==='cancelado'){for(const l of order.items){await tx`UPDATE variants SET stock=stock+${l.qty} WHERE id=${l.variantId}`;await tx`INSERT INTO inventory_moves(variant_id,delta,reason,order_id) VALUES(${l.variantId},${l.qty},'cancelado',${id})`}}await tx`UPDATE orders SET status=${status},updated_at=now() WHERE id=${id}`;return {status}})}
export async function saveProduct(input){const sql=db();const id=String(input.id||randomId('P'));if(!/^[a-zA-Z0-9_-]{1,90}$/.test(id))throw bad('ID inválido');const name=String(input.name||'').trim(),category=String(input.category||'').trim(),description=String(input.description||'').trim(),image=String(input.image||'');if(!name||name.length>120||!category||category.length>80||description.length>1000)throw bad('Datos de producto inválidos');if(!safeImage(image))throw bad('Imagen inválida, volvé a subirla');const models=input.models;if(!Array.isArray(models)||models.length<1||models.length>150||models.some(m=>typeof m!=='string'||!m.trim()||m.length>100)||new Set(models).size!==models.length)throw bad('Modelos inválidos');const tiers=input.tiers;if(!Array.isArray(tiers)||tiers.length<1||tiers.length>20||tiers.some(t=>!Number.isSafeInteger(t.min)||t.min<1||!Number.isSafeInteger(t.price)||t.price<1))throw bad('Precios mayoristas inválidos');const active=input.active!==false;
 return sql.begin(async tx=>{await tx`INSERT INTO products(id,name,category,description,image,tiers,active,deleted) VALUES(${id},${name},${category},${description},${image},${tx.json(tiers)},${active},false) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,image=excluded.image,tiers=excluded.tiers,active=excluded.active,deleted=false`;
  for(const model of models){const vid=variantId(id,model);await tx`INSERT INTO variants(id,product_id,model,stock,active) VALUES(${vid},${id},${model},0,true) ON CONFLICT(id) DO UPDATE SET active=true`}
  const vids=models.map(m=>variantId(id,m));await tx`UPDATE variants SET active=false WHERE product_id=${id} AND id<>ALL(${vids})`;return id;
 });}
export async function deleteProduct(id){const rows=await db()`UPDATE products SET deleted=true,active=false WHERE id=${id} AND deleted=false RETURNING id`;if(!rows.length)throw bad('Producto inexistente',404);return {ok:true}}
export async function setStock(id,stock){if(!Number.isSafeInteger(stock)||stock<0||stock>100000)throw bad('Stock inválido');return db().begin(async tx=>{const rows=await tx`SELECT stock FROM variants WHERE id=${id} FOR UPDATE`;if(!rows.length)throw bad('Modelo no encontrado',404);const delta=stock-rows[0].stock;await tx`UPDATE variants SET stock=${stock} WHERE id=${id}`;if(delta)await tx`INSERT INTO inventory_moves(variant_id,delta,reason) VALUES(${id},${delta},'ajuste')`;return {ok:true}})}
export async function getTexts(){const rows=await db()`SELECT key,value FROM site_texts`;return Object.fromEntries(rows.map(r=>[r.key,r.value]))}
export async function saveTexts(input){const allowed=['heroEyebrow','heroTitle','heroDescription','shippingText','catalogTitle','catalogDescription','footerText'];const sql=db();await sql.begin(async tx=>{for(const k of allowed)if(typeof input[k]==='string'){if(input[k].length>500)throw bad('Texto demasiado largo');await tx`INSERT INTO site_texts(key,value) VALUES(${k},${input[k]}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`}});return {ok:true}}
