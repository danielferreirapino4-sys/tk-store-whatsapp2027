import { devices } from './devices.js';
import { choices,choiceText } from './interactive.js';
const prefix='xirax:trial:';
export const deviceMenu=()=>choices('Em qual aparelho você quer solicitar o teste?',devices.map(d=>({id:prefix+'device:'+d.id,title:d.name})),'Escolha o dispositivo','Ver dispositivos');
const code=id=>'T'+String(id).padStart(6,'0');
function clean(text,min,max){const s=String(text||'').trim();return s.length>=min&&s.length<=max&&!s.startsWith('xirax:')&&!/^\d+$/.test(s)?s:null;}
export function createDeviceFlow({store,adminJid,send,sendChoices}){
 const list=async(jid,payload)=>sendChoices?sendChoices(jid,payload):send(jid,choiceText(payload));
 async function prompt(jid,flow){
  const data=flow.data,device=devices.find(d=>d.id===data.deviceId);
  if(flow.step==='name')return send(jid,'👋 Para solicitar seu teste, qual é o seu nome?\nDigite seu nome (não precisa de documentos).\nCancelar: /cancelarteste');
  if(flow.step==='device')return list(jid,deviceMenu());
  if(flow.step==='custom_device')return send(jid,'Qual é o tipo do seu aparelho? Ex.: receptor, central multimídia.');
  if(flow.step==='brand'){
   const brands=Object.keys(device?.brands||{});
   return list(jid,choices(`Qual é a marca do seu ${data.device}?`,[...brands.slice(0,9).map((b,i)=>({id:prefix+'brand:'+data.deviceId+':'+i,title:b})),{id:prefix+'brand:'+data.deviceId+':other',title:'Outra marca / digitar'}],'Marca do aparelho','Escolher marca'));
  }
  if(flow.step==='custom_brand')return send(jid,'Digite a marca do seu aparelho. Ex.: Samsung, LG, Apple.');
  if(flow.step==='model'){
   const models=device?.brands?.[data.brand]||[];
   return list(jid,choices('Selecione o modelo ou a linha do aparelho. Se não estiver na lista, escolha Digitar modelo. A compatibilidade será conferida pelo atendimento.',[...models.slice(0,8).map((m,i)=>({id:prefix+'model:'+data.deviceId+':'+encodeURIComponent(data.brand)+':'+i,title:m})),{id:prefix+'model:'+data.deviceId+':'+encodeURIComponent(data.brand)+':other',title:'Digitar outro modelo'},{id:prefix+'model:'+data.deviceId+':'+encodeURIComponent(data.brand)+':unknown',title:'Não sei o modelo'}],'Modelo do aparelho','Escolher modelo'));
  }
  if(flow.step==='custom_model')return send(jid,'Digite o modelo do aparelho, como aparece nas configurações ou na etiqueta. Se não souber, responda “não sei”.');
  if(flow.step==='confirm')return list(jid,choices(`Confira sua solicitação:\n👤 Nome: ${data.name}\n📱 Aparelho: ${data.device}\n🏷️ Marca: ${data.brand}\n🔎 Modelo/linha: ${data.model}\n\nO atendimento vai verificar a compatibilidade e a disponibilidade do teste. Nenhum acesso foi ativado.`,[{id:prefix+'confirm',title:'Enviar solicitação'},{id:prefix+'restart',title:'Corrigir informações'},{id:prefix+'cancel',title:'Cancelar'}],'Confirmar teste','Escolher ação'));
 }
 return async({jid,phoneJid,text})=>{
  const value=text.trim(),lower=value.toLocaleLowerCase('pt-BR'),plain=lower.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(phoneJid===adminJid){
   if(lower==='/testes'){
    const requests=store.trialRequests();await send(jid,requests.length?requests.map(r=>`${code(r.id)} · ${r.name}\n${r.device} · ${r.brand} · ${r.model}`).join('\n\n')+'\n\nEncerrar: /encerrarteste T000001':'Nenhuma solicitação de teste pendente.');return true;
   }
   if(lower.startsWith('/encerrarteste ')){
    const id=value.split(/\s+/)[1]?.replace(/^T/i,'');if(!/^\d{1,12}$/.test(id||'')){await send(jid,'Use /encerrarteste T000001.');return true;}
    await send(jid,store.closeTrial(Number(id))?'Solicitação de teste encerrada no registro. Nenhuma ativação automática foi feita.':'Solicitação não encontrada ou já encerrada.');return true;
   }
  }
  if(/^\/(testes|encerrarteste)\b/i.test(value)){await send(jid,'Comando reservado ao responsável.');return true;}
  if(['/start','start','/menu','menu'].includes(lower)){store.clearDeviceFlow(phoneJid);return false;}
  if(lower==='/cancelarteste'||value===prefix+'cancel'){
   store.clearDeviceFlow(phoneJid);await send(jid,'Solicitação em preenchimento cancelada. Para começar de novo, envie /teste.');return true;
  }
  let flow=store.deviceFlow(phoneJid);
  const launch=['/teste','teste','/dispositivos','/tv','/celular'].includes(lower)||(/\bteste\b/i.test(plain)&&/^(oi\b|ola\b|quero\b|gostaria\b|pode\b|solicitar\b|preciso\b)/i.test(plain));
  if(launch||value===prefix+'restart'){
   const pending=store.trialRequests().find(r=>r.identity===phoneJid);
   if(pending&&value!==prefix+'restart'){
    await send(jid,`Você já tem uma solicitação de teste: ${code(pending.id)}.\nNome: ${pending.name}\nAparelho: ${pending.device}\nMarca: ${pending.brand}\nModelo: ${pending.model}\nAguarde o atendimento. Para suporte, envie /suporte.`);return true;
   }
   const selected=lower==='/tv'?'tv':lower==='/celular'?'celular':null;
   const data=selected?{deviceId:selected,device:devices.find(d=>d.id===selected).name}:{};
   const step=selected?'brand':lower==='/dispositivos'?'device':'name';store.saveDeviceFlow(phoneJid,jid,step,data);await prompt(jid,store.deviceFlow(phoneJid));return true;
  }
  if(!flow){if(value.startsWith(prefix)){await send(jid,'Essa seleção não está mais ativa. Envie /teste para começar de novo.');return true;}return false;}
  if(value.startsWith('/')&&!value.startsWith(prefix))return false;
  const data=flow.data,device=devices.find(d=>d.id===data.deviceId);let step=flow.step;
  function select(options){const n=/^\d{1,2}$/.test(value)?Number(value)-1:-1;return options.find(o=>o.id===value)||options[n]||options.find(o=>o.title.toLocaleLowerCase('pt-BR')===lower);}
  if(step==='name'){
   const name=clean(value,2,80);if(!name){await send(jid,'Informe seu nome com 2 a 80 caracteres.');return true;}data.name=name;step=data.model?'confirm':'device';
  }else if(step==='device'){
   const selected=select(devices.map(d=>({id:prefix+'device:'+d.id,title:d.name,value:d})));
   if(!selected){await prompt(jid,flow);return true;}data.deviceId=selected.value.id;data.device=selected.value.name;step=selected.value.id==='outro'?'custom_device':'brand';
  }else if(step==='custom_device'){
   const custom=clean(value,2,60);if(!custom){await send(jid,'Informe o tipo do aparelho com 2 a 60 caracteres.');return true;}data.device=custom;step='custom_brand';
  }else if(step==='brand'){
   const brands=Object.keys(device.brands);const options=[...brands.slice(0,9).map((b,i)=>({id:prefix+'brand:'+data.deviceId+':'+i,title:b,value:b})),{id:prefix+'brand:'+data.deviceId+':other',title:'Outra marca / digitar'}];
   const selected=select(options);if(!selected){await prompt(jid,flow);return true;}if(selected.value){data.brand=selected.value;step='model';}else step='custom_brand';
  }else if(step==='custom_brand'){
   const brand=clean(value,2,60);if(!brand){await send(jid,'Informe a marca com 2 a 60 caracteres.');return true;}data.brand=brand;step='model';
  }else if(step==='model'){
   const models=device?.brands?.[data.brand]||[];const options=[...models.slice(0,8).map((m,i)=>({id:prefix+'model:'+data.deviceId+':'+encodeURIComponent(data.brand)+':'+i,title:m,value:m})),{id:prefix+'model:'+data.deviceId+':'+encodeURIComponent(data.brand)+':other',title:'Digitar outro modelo'},{id:prefix+'model:'+data.deviceId+':'+encodeURIComponent(data.brand)+':unknown',title:'Não sei o modelo',value:'Não informado pelo cliente'}];
   const selected=select(options);if(!selected){await prompt(jid,flow);return true;}if(selected.value){data.model=selected.value;step=data.name?'confirm':'name';}else step='custom_model';
  }else if(step==='custom_model'){
   const model=clean(value,2,100);if(!model){await send(jid,'Informe o modelo com 2 a 100 caracteres, ou responda “não sei”.');return true;}data.model=/^n[aã]o sei$/i.test(model)?'Não informado pelo cliente':model;step=data.name?'confirm':'name';
  }else if(step==='confirm'){
   const selected=select([{id:prefix+'confirm',title:'Enviar solicitação'},{id:prefix+'restart',title:'Corrigir informações'},{id:prefix+'cancel',title:'Cancelar'}]);
   if(!selected){await prompt(jid,flow);return true;}
   if(selected.id.endsWith('restart')){store.saveDeviceFlow(phoneJid,jid,'name',{});await prompt(jid,store.deviceFlow(phoneJid));return true;}
   if(selected.id.endsWith('cancel')){store.clearDeviceFlow(phoneJid);await send(jid,'Preenchimento cancelado. Envie /teste para começar de novo.');return true;}
   const {request,created}=store.openTrial(phoneJid,jid,data);store.clearDeviceFlow(phoneJid);
   await send(jid,`✅ Solicitação de teste recebida!\n🎫 Protocolo: ${code(request.id)}\n👤 ${request.name}\n📱 ${request.device}\n🏷️ ${request.brand}\n🔎 ${request.model}\n\nAguarde a conferência do atendimento. A ativação do teste depende da compatibilidade e da disponibilidade.`);
   if(created){try{await send(adminJid,`🧪 Novo teste ${code(request.id)}\nNome: ${request.name}\nAparelho: ${request.device}\nMarca: ${request.brand}\nModelo/linha: ${request.model}\nContato: ${phoneJid.split('@')[0]}\n\nVer pendências: /testes\nEncerrar registro: /encerrarteste ${code(request.id)}`);}catch{console.error('Solicitação de teste salva. Confira as pendências com /testes.');}}
   return true;
  }
  store.saveDeviceFlow(phoneJid,jid,step,data);await prompt(jid,store.deviceFlow(phoneJid));return true;
 };
}
