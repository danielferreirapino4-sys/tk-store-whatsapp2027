import makeWASocket,{useMultiFileAuthState,DisconnectReason,Browsers,jidNormalizedUser} from '@whiskeysockets/baileys';
import pino from 'pino';
export const adapter={async open(path){
 const {state,saveCreds}=await useMultiFileAuthState(path);
 const socket=makeWASocket({auth:state,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome'),markOnlineOnConnect:false,syncFullHistory:false});
 socket.ev.on('creds.update',saveCreds);
 return {
  get registered(){return Boolean(state.creds.registered);},
  pair:phone=>socket.requestPairingCode(phone),
  send:(jid,text)=>socket.sendMessage(jid,{text}),
  end:()=>socket.end(undefined),logout:()=>socket.logout(),
  onUpdate:fn=>socket.ev.on('connection.update',fn),onMessages:fn=>socket.ev.on('messages.upsert',fn),
  closeReason(update){const n=update.lastDisconnect?.error?.output?.statusCode;if(n===DisconnectReason.restartRequired)return 'restart';if([DisconnectReason.loggedOut,DisconnectReason.connectionReplaced,DisconnectReason.badSession,DisconnectReason.forbidden].includes(n))return 'terminal';return 'retry';},
  async resolvePhone(jid){if(jid.endsWith('@lid')){const mapped=await socket.signalRepository.lidMapping.getPNForLID(jid);if(mapped)return jidNormalizedUser(mapped);}return jidNormalizedUser(jid);}
 };
}};
