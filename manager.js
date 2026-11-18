import { mkdirSync,readFileSync,writeFileSync,renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHash,randomBytes } from 'node:crypto';
import { createHandler } from './handler.js';
export function normalizePhone(value) {
 const p=String(value||'').replace(/[\s()+-]/g,'');
 if(!/^[1-9]\d{9,14}$/.test(p))throw new Error('Informe DDI, DDD e número. Exemplo: 55 11 99999-9999.');
 return p;
}
export class Manager {
 constructor({dir,store,adapter,shopUrl}) {
  this.dir=dir;this.store=store;this.adapter=adapter;this.shopUrl=shopUrl;
  this.current=null;this.generation=0;this.timer=null;this.stopping=false;this.queue=Promise.resolve();
  this.state={status:'disconnected',message:'Informe um número de teste para conectar.',phone:'',admin:'',code:null};
  mkdirSync(dir,{recursive:true,mode:0o700});
 }
 view(){const {code,codeUntil,...rest}=this.state;return {...rest,code:Date.now()<(codeUntil||0)?code:null};}
 save(config){const p=join(this.dir,'connection.json');writeFileSync(p+'.tmp',JSON.stringify(config),{mode:0o600});renameSync(p+'.tmp',p);this.config=config;}
 async restore(){
  try{this.config=JSON.parse(readFileSync(join(this.dir,'connection.json'),'utf8'));}
  catch(e){if(e.code!=='ENOENT')throw e;return;}
  await this.launch(this.config,true);
 }
 async pair(rawPhone,rawAdmin){
  const phone=normalizePhone(rawPhone),admin=normalizePhone(rawAdmin);
  if(phone===admin)throw new Error('Use um número diferente para o responsável.');
  if(this.state.status==='connected')throw new Error('Desconecte no painel antes de conectar outro número.');
  if(['connecting','pairing'].includes(this.state.status))throw new Error('Aguarde a tentativa atual ou toque em Parar tentativa.');
  const label=createHash('sha256').update(phone).digest('hex').slice(0,16);
  const config={phone,admin,session:label+'-'+randomBytes(8).toString('hex')};
  this.save(config);
  await this.launch(config,false);
 }
 async launch(config,restore){
  clearTimeout(this.timer);const gen=++this.generation;
  this.current?.end();this.current=null;
  this.state={status:'connecting',message:'Abrindo conexão com o WhatsApp…',phone:config.phone,admin:config.admin,code:null};
  let current;
  try{current=await this.adapter.open(join(this.dir,'sessions',config.session));}
  catch{if(gen===this.generation)this.state={...this.state,status:'error',message:'Falha ao abrir a sessão. Confira o disco e tente novamente.'};return;}
  if(gen!==this.generation){current.end();return;}
  if(restore&&!current.registered){current.end();this.state={...this.state,status:'disconnected',message:'Gere um novo código pelo painel.'};return;}
  this.current=current;
  let requested=false,hadOpen=false;
  const send=async(jid,text)=>{
   if(gen!==this.generation||this.state.status!=='connected')throw Error('WhatsApp desconectado');
   const sent=await current.send(jid,text);if(!sent?.key?.id)throw Error('Sem confirmação');return sent;
  };
  const handle=createHandler({store:this.store,adminJid:config.admin+'@s.whatsapp.net',send,shopUrl:this.shopUrl});
  current.onMessages(({messages,type})=>{
   if(type!=='notify')return;
   for(const m of messages)this.queue=this.queue.then(async()=>{
    if(gen!==this.generation||this.stopping||m.key.fromMe)return;
    const jid=m.key.remoteJid,text=m.message?.conversation||m.message?.extendedTextMessage?.text;
    if(!jid||!/@(s\.whatsapp\.net|lid)$/.test(jid)||!text||!m.key.id)return;
    const id=jid+':'+m.key.id;if(this.store.seen(id))return;this.store.mark(id);
    const phoneJid=await current.resolvePhone(m.key.remoteJidAlt||jid);
    await handle({jid,phoneJid,text});
   }).catch(()=>console.error('Falha ao processar mensagem. Confira os pedidos no painel.'));
  });
  const timeout=()=>{if(gen!==this.generation)return;this.state={...this.state,status:'error',code:null,message:'Tentativa encerrada. Gere um novo código para tentar novamente.'};++this.generation;current.end();};
  this.timer=setTimeout(timeout,150000);
  current.onUpdate(async update=>{
   if(gen!==this.generation||this.stopping)return;
   if(update.qr&&!current.registered&&!requested){
    requested=true;
    try{
     const code=await current.pair(config.phone);
     if(gen!==this.generation||this.state.status==='connected')return;
     this.state={...this.state,status:'pairing',message:'Digite o código no WhatsApp do número informado.',code,codeUntil:Date.now()+120000};
    }catch{if(gen===this.generation){clearTimeout(this.timer);this.state={...this.state,status:'error',code:null,message:'WhatsApp recusou a geração do código. Confira o número e tente novamente.'};++this.generation;current.end();}}
   }
   if(update.connection==='open'){
    hadOpen=true;clearTimeout(this.timer);
    this.state={...this.state,status:'connected',message:'WhatsApp conectado. Envie /start de outro número para testar.',code:null};
   }
   if(update.connection==='close'){
    clearTimeout(this.timer);
    ++this.generation;
    const reason=current.closeReason(update);
    if(reason==='terminal'){
     this.state={...this.state,status:'disconnected',code:null,message:'Sessão encerrada ou substituída. Confira Aparelhos conectados e gere outro código.'};return;
    }
    this.state={...this.state,status:'connecting',code:null,message:'Reconectando ao WhatsApp…'};
    // Um reinício é esperado após parear. Não recriar sessão nem perder credenciais.
    if(reason==='restart'||hadOpen||restore){this.timer=setTimeout(()=>this.launch(config,false).catch(()=>{this.state={...this.state,status:'error',message:'Falha ao reconectar.'};}),3000);}
    else{this.state={...this.state,status:'error',message:'Conexão encerrada antes do pareamento. Tente gerar um novo código.'};}
   }
  });
 }
 async pause(){++this.generation;clearTimeout(this.timer);const current=this.current;this.current=null;current?.end();this.state={...this.state,status:'disconnected',code:null,message:'Conexão parada neste painel. O aparelho pode continuar listado no WhatsApp.'};}
 async logout(){
  const current=this.current;
  if(!current||this.state.status!=='connected')throw Error('Use Parar tentativa para uma sessão desconectada.');
  await current.logout();await this.pause();
  this.save({...this.config,session:'disabled-'+randomBytes(8).toString('hex')});
  this.state.message='WhatsApp desconectado. Você pode informar outro número.';
 }
 async close(){this.stopping=true;await this.pause();await this.queue;}
}
