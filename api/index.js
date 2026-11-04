import {handle} from '../server/handler.js';
export default async function handler(req,res){const url=new URL(req.url,'https://example.com');return handle(req,res,{route:url.searchParams.get('route')||url.pathname.replace(/^\/api\/?/,'')})}
