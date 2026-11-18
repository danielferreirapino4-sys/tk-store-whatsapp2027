import makeWASocket,{useMultiFileAuthState,DisconnectReason,Browsers,jidNormalizedUser,generateWAMessageFromContent} from '@whiskeysockets/baileys';
import pino from 'pino';
import {choiceText} from './interactive.js';
export const adapter={async open(path){
 const {state,saveCreds}=await useMultiFileAuthState(path);
 const socket=makeWASocket({auth:state,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome'),markOnlineOnConnect:false,syncFullHistory:false});
 socket.ev.on('creds.update',saveCreds);
 return {
  get registered(){return Boolean(state.creds.registered);},
  pair:phone=>socket.requestPairingCode(phone),
  send:(jid,text)=>socket.sendMessage(jid,{text}),
  async sendChoices(jid,payload){
   // Native-flow usa apenas o protocolo do SDK instalado. Exibição depende do cliente WhatsApp.
   const text=choiceText(payload);
   const fallback=await socket.sendMessage(jid,{text});
   try{
    const content={interactiveMessage:{header:{title:payload.title,hasMediaAttachment:false},body:{text:'Toque abaixo para escolher uma opção. Você também pode responder pelo número na mensagem anterior.'},footer:{text:'xirax 6.1 · TKPLAYTV'},nativeFlowMessage:{buttons:[{name:'single_select',buttonParamsJson:JSON.stringify({title:payload.buttonText,sections:[{title:payload.title,rows:payload.options.map(o=>({id:o.id,title:o.title.slice(0,24),description:o.description.slice(0,72)}))}]})}],messageParamsJson:'{}',messageVersion:3}}};
    const msg=generateWAMessageFromContent(jid,content,{userJid:socket.user.id});
    await socket.relayMessage(jid,msg.message,{messageId:msg.key.id});return msg;
   }catch{
    return fallback;
   }
  },
  end:()=>socket.end(undefined),logout:()=>socket.logout(),
  onUpdate:fn=>socket.ev.on('connection.update',fn),onMessages:fn=>socket.ev.on('messages.upsert',fn),
  closeReason(update){const n=update.lastDisconnect?.error?.output?.statusCode;if(n===DisconnectReason.restartRequired)return 'restart';if([DisconnectReason.loggedOut,DisconnectReason.connectionReplaced,DisconnectReason.badSession,DisconnectReason.forbidden].includes(n))return 'terminal';return 'retry';},
  async resolvePhone(jid){if(jid.endsWith('@lid')){const mapped=await socket.signalRepository.lidMapping.getPNForLID(jid);if(mapped)return jidNormalizedUser(mapped);}return jidNormalizedUser(jid);}
 };
}};
