import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
export const bad=(message,status=400)=>Object.assign(new Error(message),{status});
export const hashPass=(password,salt=randomBytes(16).toString('hex'))=>`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
export const verifyPass=(password,stored)=>{try{const [salt,hex]=stored.split(':');const a=scryptSync(password,salt,64),b=Buffer.from(hex,'hex');return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}};
export const sha=s=>createHash('sha256').update(s).digest('hex');
export const randomId=prefix=>`${prefix}_${randomBytes(12).toString('hex')}`;
export const variantId=(pid,model)=>createHash('sha256').update(pid+'\0'+model).digest('hex').slice(0,24);
export function validateCustomer(input){
 const grab=(key,max)=>String(input?.[key]??'').trim().slice(0,max+1);
 const firstName=grab('firstName',80),lastName=grab('lastName',80),dni=grab('dni',20),phone=grab('phone',40),address=grab('address',250),city=grab('city',120),postalCode=grab('postalCode',16),email=grab('email',254);
 if(firstName.length<2||firstName.length>80)throw bad('Ingresá un nombre válido');
 if(lastName.length<2||lastName.length>80)throw bad('Ingresá un apellido válido');
 if(!/^[0-9]{7,9}$/.test(dni.replace(/[.\s]/g,'')))throw bad('Ingresá un DNI válido de 7 a 9 números');
 if(phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15)throw bad('Ingresá un teléfono válido');
 if(address.length<5||address.length>250)throw bad('Ingresá una dirección completa');
 if(city.length<2||city.length>120)throw bad('Ingresá una ciudad válida');
 if(!/^[a-zA-Z0-9\- ]{4,16}$/.test(postalCode))throw bad('Ingresá un código postal válido');
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw bad('Ingresá un correo electrónico válido');
 return {firstName,lastName,dni:dni.replace(/[.\s]/g,''),phone,address,city,postalCode,email,customer:`${firstName} ${lastName}`};
}
