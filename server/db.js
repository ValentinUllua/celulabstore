import postgres from 'postgres';
let client;
export function db(){
  if(!process.env.DATABASE_URL)throw new Error('Falta DATABASE_URL');
  if(!client)client=postgres(process.env.DATABASE_URL,{max:1,prepare:false,ssl:process.env.DB_SSL==='disable'?false:'require',idle_timeout:20,connect_timeout:12});
  return client;
}
