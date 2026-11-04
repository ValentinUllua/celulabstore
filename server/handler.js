import {randomBytes} from 'node:crypto';
import {db} from './db.js';
import {bad,sha,verifyPass} from './utils.js';
import {products,quote,createOrder,changeStatus,saveProduct,deleteProduct,setStock,getTexts,saveTexts} from './store.js';
const json=(res,status,data,extra={})=>{res.statusCode=status;for(const [k,v] of Object.entries({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',...extra}))res.setHeader(k,v);res.end(JSON.stringify(data))};
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=').map(decodeURIComponent)));
const imgRE=/^[a-f0-9]{24}\.(?:png|jpg|webp)$/;
const service=()=>{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Faltan variables de Supabase Storage');return {url:process.env.SUPABASE_URL.replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY}};
const publicURL=name=>`${service().url}/storage/v1/object/public/productos/${name}`;
async function storageRequest(path,options={}){const {url,key}=service();const r=await fetch(`${url}/storage/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,...options.headers}});if(!r.ok)throw bad('Error de almacenamiento: '+r.status,502);return r}
const secure=process.env.NODE_ENV==='production'?'; Secure':'';
const cookie=(value,age=28800)=>`celulab_admin=${value}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${age}`;
const cookieClear='celulab_admin=; Path=/; HttpOnly; SameSite=Strict'+secure+'; Max-Age=0';
function makeWhatsApp(order,input){const lines=order.lines.map(l=>`• ${l.name} / ${l.model}: ${l.qty} × $${l.unitPrice.toLocaleString('es-AR')} = $${l.subtotal.toLocaleString('es-AR')}`).join('\n');const message=`Hola Celulab, generé el pedido ${order.id} (mayorista):\n${lines}\nTOTAL $${order.total.toLocaleString('es-AR')}\nCliente: ${order.customer}\nDNI: ${input.dni}\nTel: ${order.phone}\nMail: ${input.email}\nEntrega: ${input.address}, ${input.city} (CP ${input.postalCode})\nObservaciones: ${input.notes||'-'}\nPor favor confirmá el pedido.`;return 'https://wa.me/542478573698?text='+encodeURIComponent(message)}
const readBody=async(req,limit=4*1024*1024)=>{if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{throw bad('JSON inválido')}}let raw='';for await(const c of req){raw+=c.toString();if(Buffer.byteLength(raw)>limit)throw bad('Solicitud demasiado grande',413)}try{return JSON.parse(raw||'{}')}catch{throw bad('JSON inválido')}};
async function isAdmin(req){const token=cookies(req).celulab_admin;if(!token)return false;return (await db()`SELECT token_hash FROM sessions WHERE token_hash=${sha(token)} AND expires_at>${Date.now()}`).length>0}
function checkOrigin(req){if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return;const origin=req.headers.origin;if(!origin)throw bad('Origen obligatorio',403);const host=req.headers['x-forwarded-host']||req.headers.host;const proto=req.headers['x-forwarded-proto']||'https';const allowed=process.env.SITE_URL;let u;try{u=new URL(origin)}catch{throw bad('Origen inválido',403)};if(u.host!==host||u.protocol!==proto+':'||(allowed&&u.origin!==new URL(allowed).origin))throw bad('Origen no autorizado',403)}
async function rateLogin(req){const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim(),key=sha(ip),now=Date.now();return db().begin(async tx=>{let rows=await tx`SELECT * FROM login_attempts WHERE ip_hash=${key} FOR UPDATE`;if(!rows.length){await tx`INSERT INTO login_attempts(ip_hash,attempts,window_start) VALUES(${key},0,${now})`;rows=[{attempts:0,window_start:now}]};const r=rows[0];if(now-r.window_start>=15*60*1000)await tx`UPDATE login_attempts SET attempts=0,window_start=${now} WHERE ip_hash=${key}`;else if(r.attempts>=10)throw bad('Demasiados intentos. Probá más tarde.',429);return key})}
export async function handle(req,res,{route}={}){
 const path='/api/'+String(route||'').replace(/^\/+|\/+$/g,'');
 try{
  checkOrigin(req);const sql=db(),method=req.method;
  if(method==='GET'&&path==='/api/config')return json(res,200,{whatsapp:'542478573698',minimumWholesale:70000,siteTexts:await getTexts(),adminInitialized:!!process.env.ADMIN_PASSWORD_HASH});
  if(method==='GET'&&path==='/api/products')return json(res,200,await products());
  if(method==='POST'&&path==='/api/quote')return json(res,200,await quote(await readBody(req)));
  if(method==='POST'&&path==='/api/orders'){const input=await readBody(req),o=await createOrder(input);return json(res,201,{id:o.id,status:o.status,total:o.total,lines:o.lines,whatsappUrl:makeWhatsApp(o,input)})}
  if(method==='GET'&&/^\/api\/orders\/CL_[0-9a-f]{24}$/.test(path)){const rows=await sql`SELECT id,status,created_at,mode,method,total FROM orders WHERE id=${path.split('/').at(-1)}`;if(!rows.length)throw bad('Pedido no encontrado',404);return json(res,200,rows[0])}
  if(method==='POST'&&path==='/api/admin/login'){
   const key=await rateLogin(req),{password}=await readBody(req);if(!process.env.ADMIN_PASSWORD_HASH)throw bad('Falta configurar ADMIN_PASSWORD_HASH',503);
   if(typeof password!=='string'||!verifyPass(password,process.env.ADMIN_PASSWORD_HASH)){await sql`UPDATE login_attempts SET attempts=attempts+1 WHERE ip_hash=${key}`;throw bad('Credenciales incorrectas',401)}
   await sql`DELETE FROM login_attempts WHERE ip_hash=${key}`;const token=randomBytes(32).toString('hex');await sql`INSERT INTO sessions(token_hash,expires_at) VALUES(${sha(token)},${Date.now()+28800000})`;return json(res,200,{ok:true},{'Set-Cookie':cookie(token)});
  }
  if(method==='GET'&&path==='/api/admin/me')return json(res,200,{authenticated:await isAdmin(req)});
  if(path.startsWith('/api/admin/')){
   if(!await isAdmin(req))throw bad('Iniciá sesión como administrador',401);
   if(method==='POST'&&path==='/api/admin/logout'){await sql`DELETE FROM sessions WHERE token_hash=${sha(cookies(req).celulab_admin||'')}`;return json(res,200,{ok:true},{'Set-Cookie':cookieClear})}
   if(method==='GET'&&path==='/api/admin/products')return json(res,200,await products(true));
   if(method==='PUT'&&path==='/api/admin/products')return json(res,200,{id:await saveProduct(await readBody(req))});
   if(method==='DELETE'&&path.startsWith('/api/admin/products/'))return json(res,200,await deleteProduct(decodeURIComponent(path.slice('/api/admin/products/'.length))));
   if(method==='PATCH'&&path.startsWith('/api/admin/products/')&&path.endsWith('/image')){
    const id=decodeURIComponent(path.slice('/api/admin/products/'.length,-'/image'.length));const {url}=await readBody(req);if(typeof url!=='string')throw bad('Imagen inválida');let filename;try{new URL(url);const pre=publicURL('');if(!url.startsWith(pre))throw Error();filename=url.slice(pre.length);if(!imgRE.test(filename))throw Error()}catch{throw bad('Imagen inválida')};const result=await sql`UPDATE products SET image=${url} WHERE id=${id} AND deleted=false RETURNING id`;if(!result.length)throw bad('Producto no encontrado',404);return json(res,200,{ok:true,image:url});
   }
   if(method==='PATCH'&&/^\/api\/admin\/stock\/[a-f0-9]{24}$/.test(path))return json(res,200,await setStock(path.split('/').at(-1),(await readBody(req)).stock));
   if(method==='GET'&&path==='/api/admin/orders'){const rows=await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 300`;return json(res,200,rows)}
   if(method==='PATCH'&&/^\/api\/admin\/orders\/CL_[0-9a-f]{24}$/.test(path))return json(res,200,await changeStatus(path.split('/').at(-1),(await readBody(req)).status));
   if(method==='GET'&&path==='/api/admin/movements')return json(res,200,await sql`SELECT * FROM inventory_moves ORDER BY id DESC LIMIT 300`);
   if(method==='PUT'&&path==='/api/admin/texts')return json(res,200,await saveTexts(await readBody(req)));
   if(method==='GET'&&path==='/api/admin/images'){
    const response=await storageRequest('object/list/productos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:300,offset:0,sortBy:{column:'created_at',order:'desc'}})});
    const rows=await response.json();return json(res,200,rows.filter(x=>imgRE.test(x.name)).map(x=>({name:x.name,url:publicURL(x.name),modified:Date.parse(x.updated_at||x.created_at)||0})));
   }
   if(method==='POST'&&path==='/api/admin/image'){
    const {data}=await readBody(req);if(typeof data!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw bad('Imagen inválida');const raw=Buffer.from(data.slice(data.indexOf(',')+1),'base64');if(raw.length===0||raw.length>2*1024*1024)throw bad('Imagen demasiado grande');const mime=data.match(/^data:(image\/(?:png|jpeg|webp));base64,/)[1];const ext=mime==='image/jpeg'?'jpg':mime.split('/')[1];const signature=ext==='png'?raw.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):ext==='jpg'?raw[0]===255&&raw[1]===216:raw.toString('ascii',0,4)==='RIFF'&&raw.toString('ascii',8,12)==='WEBP';if(!signature)throw bad('El archivo no coincide con el tipo de imagen');const name=randomBytes(12).toString('hex')+'.'+ext;
    await storageRequest('object/productos/'+name,{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false','Cache-Control':'3600'},body:raw});return json(res,200,{url:publicURL(name)});
   }
  }
  throw bad('Ruta inexistente',404);
 }catch(e){if(!e.status)console.error(e);return json(res,e.status||500,{error:e.status?e.message:'Error del servidor'})}
}
