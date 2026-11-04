import fs from 'node:fs';import {db} from '../server/db.js';import {variantId} from '../server/utils.js';
const data=JSON.parse(fs.readFileSync(new URL('../supabase/catalog.json',import.meta.url),'utf8'));
const sql=db();
let created=0;
for(const p of data){const existing=await sql`SELECT id FROM products WHERE id=${p.id}`;if(existing.length)continue;await sql.begin(async tx=>{await tx`INSERT INTO products(id,name,category,description,image,tiers,active,deleted,source_wholesale) VALUES(${p.id},${p.name},${p.category},${p.description||''},'',${tx.json(p.tiers)},true,false,${p.sourceWholesale||null})`;for(const m of p.models){await tx`INSERT INTO variants(id,product_id,model,stock) VALUES(${variantId(p.id,m)},${p.id},${m},0)`}});created++}
console.log(`Semilla completa: ${created} productos nuevos; ninguno existente fue sobrescrito.`);await sql.end();
