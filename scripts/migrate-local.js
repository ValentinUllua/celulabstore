// Ejecutar UNA VEZ antes de atender pedidos reales, con DB vacía salvo catálogo opcional.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import path from 'node:path';
import {db} from '../server/db.js';
const arg=process.argv[2];if(!arg){console.error('Uso: node scripts/migrate-local.js /ruta/a/celulab.sqlite /ruta/a/public/uploads');process.exit(1)}
const file=path.resolve(arg),images=path.resolve(process.argv[3]||path.join(path.dirname(file),'../public/uploads'));
if(!fs.existsSync(file)){console.error('No existe',file);process.exit(1)}
const old=new DatabaseSync(file,{readOnly:true}),sql=db();
const tables=['products','variants','orders','inventory_moves','site_texts'];
const found=new Set(old.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
async function imgUrl(image){if(!image||!image.startsWith('/uploads/'))return image||'';const name=path.basename(image);if(!/^[a-f0-9]{24}\.(?:png|jpg|webp)$/.test(name))return '';const target=path.join(images,name);if(!fs.existsSync(target)){console.warn('Sin archivo para imagen',name);return ''}if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('Faltan variables de Supabase Storage');const bytes=fs.readFileSync(target);const mime=name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg';const r=await fetch(`${SUPABASE_URL.replace(/\/$/,'')}/storage/v1/object/productos/${name}`,{method:'POST',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':mime,'x-upsert':'true'},body:bytes});if(!r.ok)throw Error('Fallo subida '+name+' '+r.status+' '+await r.text());return SUPABASE_URL.replace(/\/$/,'')+'/storage/v1/object/public/productos/'+name}
async function run(){const p=old.prepare('SELECT * FROM products').all(),v=old.prepare('SELECT * FROM variants').all(),o=old.prepare('SELECT * FROM orders').all(),moves=old.prepare('SELECT * FROM inventory_moves').all(),texts=old.prepare('SELECT * FROM site_texts').all();
 // Se detiene si la DB de destino ya tiene pedidos; evita doble reserva o duplicación.
 const existing=await sql`SELECT count(*)::integer n FROM orders`;if(existing[0].n>0)throw Error('La base destino ya tiene pedidos. Detenido para evitar duplicaciones.');
 for(const row of p){const image=await imgUrl(row.image);await sql`INSERT INTO products(id,name,category,description,image,tiers,active,deleted,source_wholesale) VALUES(${row.id},${row.name},${row.category},${row.description||''},${image},${sql.json(JSON.parse(row.tiers))},${!!row.active},${!!row.deleted},${row.source_wholesale||null}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,image=excluded.image,tiers=excluded.tiers,active=excluded.active,deleted=excluded.deleted`}
 for(const row of v)await sql`INSERT INTO variants(id,product_id,model,stock,active) VALUES(${row.id},${row.product_id},${row.model},${row.stock},${!!row.active}) ON CONFLICT(id) DO UPDATE SET stock=excluded.stock,active=excluded.active`;
 for(const row of o)await sql`INSERT INTO orders(id,created_at,updated_at,customer,phone,address,notes,mode,method,status,total,items,first_name,last_name,dni,city,postal_code,email) VALUES(${row.id},${row.created_at},${row.updated_at},${row.customer},${row.phone},${row.address},${row.notes||''},${row.mode},${row.method},${row.status},${row.total},${sql.json(JSON.parse(row.items))},${row.first_name||''},${row.last_name||''},${row.dni||''},${row.city||''},${row.postal_code||''},${row.email||''}) ON CONFLICT(id) DO NOTHING`;
 for(const row of moves)await sql`INSERT INTO inventory_moves(variant_id,delta,reason,order_id,created_at) VALUES(${row.variant_id},${row.delta},${row.reason},${row.order_id},${row.created_at})`;
 for(const row of texts)await sql`INSERT INTO site_texts(key,value) VALUES(${row.key},${row.value}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
 console.log('Migración terminada:',p.length,'productos,',v.length,'variantes,',o.length,'pedidos,',moves.length,'movimientos,',texts.length,'textos.');
}
try{await run()}catch(e){console.error('Migración incompleta:',e.message,'No la repitas a ciegas; revisá datos en destino.');process.exitCode=1}finally{old.close();await sql.end()}
