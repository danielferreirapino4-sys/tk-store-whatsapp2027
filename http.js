import { createServer } from 'node:http';
import { randomBytes,scryptSync,timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { confirm } from './store.js';
export function makeServer({manager,store,password,htmlPath}){
 if(!password||password.length<12)throw Error('Configure PANEL_PASSWORD com pelo menos 12 caracteres no Render.');
 const salt=randomBytes(16),hash=scryptSync(password,salt,32),sessions=new Map();
 let loginAttempts=[];
 const html=readFileSync(htmlPath);
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 async function body(req){let result='';for await(const chunk of req){result+=chunk;if(Buffer.byteLength(result)>8192)throw Error('Dados muito grandes.');}return JSON.parse(result||'{}');}
 function session(req){const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('tk_session='))?.slice(11);const s=sessions.get(token);return s&&s.until>Date.now()?{...s,token}:null;}
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const path=req.url?.split('?')[0];
  if(req.method==='GET'&&path==='/healthz'){json(res,200,{ok:true});return;}
  if(req.method==='GET'&&path==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;}
  if(!path?.startsWith('/api/')){json(res,404,{error:'Não encontrado.'});return;}
  try{
   // APIs de escrita exigem requisição JSON do próprio painel; formulários externos não são aceitos.
   if(req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json')||req.headers['x-tk-panel']!=='1'){json(res,403,{error:'Abra o painel para executar esta ação.'});return;}
    if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host){json(res,403,{error:'Origem não permitida.'});return;}}
   }
   if(path==='/api/login'&&req.method==='POST'){
    loginAttempts=loginAttempts.filter(t=>Date.now()-t<600000);
    if(loginAttempts.length>=20){json(res,429,{error:'Muitas tentativas. Aguarde 10 minutos.'});return;}
    const data=await body(req);loginAttempts.push(Date.now());
    if(typeof data.password!=='string'||data.password.length>256||!timingSafeEqual(hash,scryptSync(data.password,salt,32))){json(res,401,{error:'Senha incorreta.'});return;}
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
    for(const [key,s]of sessions)if(s.until<Date.now())sessions.delete(key);
    sessions.set(token,{csrf,until:Date.now()+8*3600000});
    const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';
    res.setHeader('Set-Cookie',`tk_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure?'; Secure':''}`);
    json(res,200,{ok:true,csrf});return;
   }
   const s=session(req);
   if(!s){json(res,401,{error:'Entre com sua senha do painel.'});return;}
   if(path==='/api/state'&&req.method==='GET'){json(res,200,{...manager.view(),csrf:s.csrf});return;}
   if(path==='/api/orders'&&req.method==='GET'){json(res,200,{orders:store.list()});return;}
   if(req.method!=='POST'){json(res,405,{error:'Método não permitido.'});return;}
   if(req.headers['x-csrf-token']!==s.csrf){json(res,403,{error:'Sessão inválida. Entre novamente.'});return;}
   const data=await body(req);
   if(path==='/api/connect'){
    await manager.pair(data.phone,data.admin);json(res,200,{ok:true});return;
   }
   if(path==='/api/pause'){await manager.pause();json(res,200,{ok:true});return;}
   if(path==='/api/disconnect'){await manager.logout();json(res,200,{ok:true});return;}
   if(path==='/api/confirm'){
    if(manager.view().status!=='connected'){json(res,409,{error:'Conecte o WhatsApp antes de confirmar.'});return;}
    const id=String(data.id||'');if(!/^[A-F0-9]{12}$/.test(id))throw Error('Pedido inválido.');
    const result=await confirm(store,id,async(jid,text)=>{
     const sent=await manager.current.send(jid,text);if(!sent?.key?.id)throw Error('Sem confirmação');
    });json(res,200,{message:result});return;
   }
   if(path==='/api/logout'){
    sessions.delete(s.token);res.setHeader('Set-Cookie','tk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json(res,200,{ok:true});return;
   }
   json(res,404,{error:'Não encontrado.'});
  }catch(error){json(res,400,{error:error instanceof SyntaxError?'Dados inválidos.':String(error.message||'Não foi possível executar a ação.').slice(0,240)});}
 });
}
