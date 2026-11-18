import makeWASocket,{DisconnectReason,useMultiFileAuthState,jidNormalizedUser,Browsers} from '@whiskeysockets/baileys';
import pino from 'pino';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {Store} from './store.js';
import {createHandler} from './handler.js';
const dir=process.env.DATA_DIR||'./data';
const phone=process.env.BOT_PHONE_NUMBER||'';
const admin=process.env.ADMIN_PHONE_NUMBER||'';
if(!/^[1-9]\d{9,14}$/.test(phone)||!/^[1-9]\d{9,14}$/.test(admin)||phone===admin)throw Error('Configure BOT_PHONE_NUMBER e ADMIN_PHONE_NUMBER com DDI, somente dígitos e diferentes.');
mkdirSync(dir,{recursive:true,mode:0o700});
const store=new Store(join(dir,'orders.sqlite3'));
const adminJid=admin+'@s.whatsapp.net';
let sock,stopping=false,reconnectTimer,queue=Promise.resolve(),attempt=0;
const log=pino({level:'silent'});
async function start(){
 const {state,saveCreds}=await useMultiFileAuthState(join(dir,'session'));
 let pairingRequested=false;
 const current=makeWASocket({auth:state,logger:log,browser:Browsers.ubuntu('Chrome'),markOnlineOnConnect:false,syncFullHistory:false});
 sock=current;
 current.ev.on('creds.update',saveCreds);
 current.ev.on('connection.update',async update=>{
  if(stopping||current!==sock)return;
  if(update.qr&&!state.creds.registered&&!pairingRequested){
   pairingRequested=true;
   try{const code=await current.requestPairingCode(phone); console.log('Código privado de pareamento TK STORE:',code,'— não compartilhe.');}
   catch{console.error('Falha ao gerar código. Reinicie o serviço para tentar novamente.');}
  }
  if(update.connection==='open'){attempt=0;console.log('TK STORE conectado. Envie /start de outro WhatsApp. Responsável: /admin.');}
  if(update.connection==='close'){
   const reason=update.lastDisconnect?.error?.output?.statusCode;
   if(reason===DisconnectReason.loggedOut||reason===DisconnectReason.connectionReplaced){console.error('Sessão encerrada ou substituída. Verifique aparelhos conectados e sessão antes de reiniciar.');return;}
   clearTimeout(reconnectTimer);
   reconnectTimer=setTimeout(()=>{start().catch(()=>console.error('Falha ao reconectar. Reinicie após verificar a rede.'));},Math.min(30000,1000*2**Math.min(attempt++,5)));
  }
 });
 const send=async(jid,text)=>{if(current!==sock||stopping)throw Error('Conexão indisponível');const sent=await current.sendMessage(jid,{text});if(!sent?.key?.id)throw Error('Sem ID de mensagem');};
 const handle=createHandler({store,adminJid,send,shopUrl:process.env.SHOP_URL||'https://tkplaytv.tkplaytv9.chatgpt.site/'});
 current.ev.on('messages.upsert',({messages,type})=>{
  if(type!=='notify'||stopping)return;
  for(const m of messages){
   queue=queue.then(async()=>{
    if(current!==sock||m.key.fromMe)return;
    const jid=m.key.remoteJid;
    if(!jid||!/@(s\.whatsapp\.net|lid)$/.test(jid))return;
    const text=m.message?.conversation||m.message?.extendedTextMessage?.text;
    if(!text||!m.key.id)return;
    const key=jid+':'+m.key.id;
    if(store.seen(key))return;
    // Registrar antes de executar: notificações repetidas não geram confirmação dupla.
    store.mark(key);
    let phoneJid=jidNormalizedUser(m.key.remoteJidAlt||jid);
    if(jid.endsWith('@lid')&&!phoneJid.endsWith('@s.whatsapp.net')) {
     const mapped=await current.signalRepository.lidMapping.getPNForLID(jid);
     if(mapped)phoneJid=jidNormalizedUser(mapped);
    }
    await handle({jid,phoneJid,text});
   }).catch(()=>console.error('Uma mensagem não pôde ser processada. Confira /pedidos e o atendimento; nenhum reenvio automático foi feito.'));
  }
 });
}
async function stop(){stopping=true;clearTimeout(reconnectTimer);await queue; sock?.end(undefined);store.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
 

  console.error("Falha ao iniciar:", erro.message);
  process.exit(1);

