export const ticketNumber = id => '#' + String(id).padStart(6, '0');
const labels = {waiting:'🟡 Aguardando na fila',called:'🔔 Sua vez chegou',active:'🟢 Em atendimento',waiting_customer:'⏳ Aguardando sua resposta',closed:'✅ Atendimento concluído',cancelled:'❌ Atendimento cancelado'};
export function supportText(store,ticket){
 const position=store.supportPosition(ticket);
 return `🎧 *xirax 6.1 — Suporte TKPLAYTV*\n🎫 Atendimento: *${ticketNumber(ticket.id)}*\n${position?`📍 Posição na fila: *${position}º*\n`:''}Status: ${labels[ticket.state]}\n${ticket.state==='waiting'?'Aguarde. Avisaremos quando sua posição ou seu status mudar.\nConsulte: /minhafila · Cancelar: /sairdafila':ticket.state==='called'?'O responsável chamou seu atendimento. Responda por esta conversa.':ticket.state==='waiting_customer'?'Responda nesta conversa para continuar. O responsável dará sequência ao atendimento.':ticket.state==='closed'||ticket.state==='cancelled'?'Se precisar, envie /suporte para abrir outro atendimento.':'Consulte seu atendimento com /minhafila.'}`;
}
export function createSupport({store,adminJid,send}){
 async function notify(jid,text){try{await send(jid,text);return true;}catch{return false;}}
 function positions(){return new Map(store.supportWaiting().map((t,i)=>[t.id,i+1]));}
 async function updatePositions(before,skip){let failed=0;for(const t of store.supportWaiting()){if(t.id!==skip&&before.get(t.id)!==store.supportPosition(t)){if(!await notify(t.jid,supportText(store,t)))failed++;}}return failed;}
 return async({jid,phoneJid,text})=>{
  const value=text.trim(),parts=value.split(/\s+/),cmd=parts[0].toLowerCase();
  const owner=phoneJid===adminJid;
  const adminCommands=['/fila','/chamar','/assumir','/aguardar','/concluir','/cancelaratendimento','/atendimento'];
  if(adminCommands.includes(cmd)){
   if(!owner){await send(jid,'Comando reservado ao responsável TKPLAYTV.');return true;}
   if(cmd==='/fila'){
    const page=store.supportPage(parts[1]);
    await send(jid,`🎧 *Fila de suporte — TKPLAYTV*\n${page.total} atendimento(s) aberto(s) · Página ${page.page} de ${page.totalPages}\n\n`+(page.tickets.map(t=>`${ticketNumber(t.id)} · ${labels[t.state]}${t.state==='waiting'?' · '+store.supportPosition(t)+'º':''}`).join('\n')||'Nenhum cliente na fila.')+'\n\n/chamar — chamar próximo\n/assumir NUMERO — iniciar atendimento\n/atendimento NUMERO — detalhes\n/fila 2 — próxima página');return true;
   }
   let ticket;
   if(cmd==='/chamar'){ticket=store.supportWaiting()[0];if(!ticket){await send(jid,'Nenhum cliente aguardando na fila.');return true;}}
   else{
    const id=String(parts[1]||'').replace(/^#/,'');
    if(!/^\d{1,12}$/.test(id)||Number(id)<1){await send(jid,`Use ${cmd} NUMERO. Exemplo: ${cmd} 000001`);return true;}
    ticket=store.supportTicket(Number(id));if(!ticket){await send(jid,'Atendimento não encontrado.');return true;}
   }
   if(cmd==='/atendimento'){
    const phone=ticket.identity.split('@')[0];
    const contact=/^[1-9]\d{9,14}$/.test(phone)?`\nConversa: https://wa.me/${phone}`:'\nAbra a conversa do cliente no WhatsApp da loja.';
    await send(jid,supportText(store,ticket)+(ticket.reason?'\nMotivo informado: '+ticket.reason:'')+contact);return true;
   }
   const target={'/chamar':'called','/assumir':'active','/aguardar':'waiting_customer','/concluir':'closed','/cancelaratendimento':'cancelled'}[cmd];
   const before=positions();let result;
   try{result=store.changeSupport(ticket.id,target);}catch(e){await send(jid,e.message);return true;}
   if(!result.changed){await send(jid,`Atendimento ${ticketNumber(ticket.id)} já está com esse status. Nenhum novo aviso enviado.`);return true;}
   const reason=cmd==='/cancelaratendimento'?value.split(/\s+/).slice(2).join(' ').slice(0,500):'';
   const delivered=await notify(result.ticket.jid,supportText(store,result.ticket)+(reason?'\nMotivo: '+reason:''));
   const failures=await updatePositions(before,ticket.id);
   await send(jid,`Atendimento ${ticketNumber(ticket.id)}: ${labels[target]}.${!delivered||failures?'\nAlgum aviso ficou sem confirmação de envio. Confira as conversas.':''}`);return true;
  }
  if(cmd==='/suporte'||value==='8'){
   if(owner){await send(jid,'Você é o responsável. Use /fila para administrar os atendimentos.');return true;}
   const {ticket,created}=store.openSupport(jid,phoneJid,cmd==='/suporte'?parts.slice(1).join(' '):'');
   await send(jid,(created?'':'Você já tem um atendimento aberto.\n')+supportText(store,ticket));
   if(created)await notify(adminJid,`🎧 Novo suporte: ${ticketNumber(ticket.id)}\nPosição: ${store.supportPosition(ticket)}º\nUse /atendimento ${ticket.id} para detalhes ou /chamar para chamar o próximo.`);return true;
  }
  if(cmd==='/minhafila'){
   const ticket=store.latestSupport(phoneJid);await send(jid,ticket?supportText(store,ticket):'Você ainda não tem atendimento. Envie /suporte para entrar na fila.');return true;
  }
  if(cmd==='/sairdafila'){
   const ticket=store.currentSupport(phoneJid);if(!ticket){await send(jid,'Você não tem atendimento aberto.');return true;}
   const before=positions();const {ticket:updated}=store.changeSupport(ticket.id,'cancelled');
   await send(jid,supportText(store,updated));const failures=await updatePositions(before,ticket.id);
   await notify(adminJid,`O cliente cancelou o atendimento ${ticketNumber(ticket.id)}.${failures?' Confira avisos de posição nas conversas.':''}`);return true;
  }
  return false;
 };
}
