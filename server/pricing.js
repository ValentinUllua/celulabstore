import {bad} from './utils.js';
export const MIN_WHOLESALE=70000;
export function priceQuote(input,ps,vs){
 if(input?.mode!==undefined&&input.mode!=='mayorista')throw bad('Solo se permiten compras mayoristas');
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>120)throw bad('Seleccioná de 1 a 120 variantes');
 const selected=[],seen=new Set(),byFamily=new Map();
 for(const entry of input.items){const qty=entry.qty,pid=String(entry.productId||''),vid=String(entry.variantId||'');if(!Number.isSafeInteger(qty)||qty<1||qty>5000)throw bad('Cantidad inválida');if(seen.has(vid))throw bad('Variante repetida');seen.add(vid);const p=ps.find(p=>p.id===pid&&p.active&&!p.deleted),v=vs.find(v=>v.id===vid&&v.product_id===pid&&v.active);if(!p||!v)throw bad('Producto o modelo no disponible');if(v.stock<qty)throw bad(`Stock insuficiente: ${p.name} / ${v.model}`);selected.push({productId:pid,variantId:vid,name:p.name,model:v.model,qty,tiers:p.tiers});byFamily.set(pid,(byFamily.get(pid)||0)+qty)}
 let total=0;const lines=selected.map(l=>{const tier=[...l.tiers].filter(t=>byFamily.get(l.productId)>=Number(t.min)&&Number(t.price)>0).sort((a,b)=>b.min-a.min)[0];const unit=Number(tier?.price);if(!Number.isSafeInteger(unit)||unit<=0)throw bad(`Precio no publicado o mínimo por producto sin alcanzar: ${l.name}`);const subtotal=unit*l.qty;if(!Number.isSafeInteger(subtotal))throw bad('Importe demasiado alto');total+=subtotal;const {tiers,...clean}=l;return {...clean,unitPrice:unit,subtotal}});
 if(!Number.isSafeInteger(total))throw bad('Importe demasiado alto');if(total<MIN_WHOLESALE&&!input.preview)throw bad('Pedido mayorista mínimo $70.000');return {mode:'mayorista',total,lines,minimumWholesale:MIN_WHOLESALE,wholesaleEligible:total>=MIN_WHOLESALE,minimumRemaining:Math.max(0,MIN_WHOLESALE-total)};
}
