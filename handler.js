import { catalog,money,MENU } from './catalog.js';
import { confirm } from './store.js';
export function createHandler({store,adminJid,send,shopUrl}) {
 return async ({jid,phoneJid,text})=>{
  const value=text.trim(),lower=value.toLowerCase();
  if(phoneJid===adminJid){
   if(lower==='/admin')return send(jid,'*TK STORE — responsável*\n/pedidos — pendências\n/pago ID — confirmar Pix conferido e avisar cliente\n/status ID — consultar pedido\n/valor ID 20,00 — ajustar valor combinado\n/pago não confirma recebimento no banco: use somente após conferir.');
   if(lower==='/pedidos')return send(jid,store.list().map(o=>`${o.id} · ${o.product} · ${money(o.cents)} · ${o.state}`).join('\n')||'Nenhum pedido pendente.');
   if(/^\/pago\s+/i.test(value))return send(jid,await confirm(store,value.split(/\s+/)[1].toUpperCase(),send));
   if(/^\/valor\s+/i.test(value)) {
    const [,id,raw]=value.split(/\s+/); const amount=/^\d{1,6}([.,]\d{1,2})?$/.test(raw||'')?Math.round(Number(raw.replace(',','.'))*100):0;
    const order=store.get((id||'').toUpperCase());
    if(!order||order.state!=='pending'||amount<=0||amount>10000000)return send(jid,'Informe um pedido pendente e valor válido: /valor ID 20,00');
    store.db.prepare("UPDATE orders SET cents=? WHERE id=? AND state='pending'").run(amount,order.id);
    await send(order.jid,`Pedido ${order.id}: valor final combinado ${money(amount)}. Aguarde as instruções de pagamento do atendimento.`);
    return send(jid,'Valor atualizado.');
   }
   if(/^\/status\s+/i.test(value)) {const o=store.get(value.split(/\s+/)[1].toUpperCase());return send(jid,o?`${o.id}: ${o.state}`:'Pedido não encontrado.');}
  }
  if(/^\/(pago|pedidos|admin|status|valor)\b/i.test(value))return send(jid,'Comando reservado ao responsável.');
  if(['start','/start','menu','oi','olá','ola'].includes(lower))return send(jid,MENU);
  const categories={'1':'streaming','2':'musica','3':'digital','4':'outros','5':'tv'};
  if(categories[value])return send(jid,catalog.filter(p=>p.category===categories[value]).map(p=>`*${p.id}* — ${p.name}: ${money(p.cents)}\n${p.terms}`).join('\n\n')+'\n\nExemplo: /comprar 01\nRenovação: /renovar 01\nConsulte disponibilidade antes de pagar.');
  if(value==='6'||value==='8') {
   await send(jid,value==='6'?'Informe o modelo do aparelho e aguarde o atendimento para verificar o teste de até 4 horas.':'Descreva sua dúvida ou problema. O atendimento continuará por aqui.');
   if(adminJid!==phoneJid)await send(adminJid,`TK STORE: solicitação de ${value==='6'?'teste':'suporte'} recebida. Consulte as conversas do WhatsApp da loja.`);
   return;
  }
  if(value==='7')return send(jid,'Consulte a categoria do seu plano e envie /renovar CÓDIGO. O preço e as condições da renovação serão confirmados pelo atendimento antes do pagamento.');
  const match=value.match(/^\/(comprar|renovar)\s+(\d{1,2})$/i);
  if(match){
   const p=catalog.find(p=>p.id===match[2].padStart(2,'0'));
   if(!p)return send(jid,'Código não encontrado. Envie /start.');
   const kind=match[1].toLowerCase()==='renovar'?'renovacao':'compra';
   const order=store.create(jid,p,kind);
   await send(jid,`🛍️ *Pedido ${order.id}*\n${p.name}\n${kind==='renovacao'?'Valor de referência; renovação a confirmar':'Valor informado'}: ${money(p.cents)}\n${p.terms}\n\nAguarde o atendimento confirmar disponibilidade, valor final e instruções de pagamento.\nApós conferirmos o Pix, você receberá a confirmação.\nLoja: ${shopUrl}`);
   await send(adminJid,`🛍️ Pedido ${order.id}\nTipo: ${kind}\n${p.name}\nReferência: ${money(p.cents)}\n${p.terms}\nConfira valor, disponibilidade e Pix antes de usar /pago ${order.id}.\nPedidos repetidos pendentes usam o mesmo ID.`);
   return;
  }
  // Não responde a cada mensagem: o responsável pode conversar normalmente.
 };
}
