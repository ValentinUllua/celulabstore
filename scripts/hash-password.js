import {hashPass} from '../server/utils.js';
const password=process.argv[2]||process.env.ADMIN_NEW_PASSWORD;
if(!password||password.length<12){console.error('Uso: node scripts/hash-password.js "contraseña-larga-de-12+-caracteres"');process.exit(1)}
console.log('\nADMIN_PASSWORD_HASH='+hashPass(password)+'\n');
console.log('Guardá ese hash como variable privada en Vercel; no publiques tu contraseña.');
