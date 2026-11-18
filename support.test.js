import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.js';
import {createHandler} from './handler.js';
import {Simulator} from './simulator.js';
function fixture(){const store=new Store(':memory:'),messages=[];const handler=createHandler({store,adminJid:'owner',shopUrl:'https://example.test',send:async(jid,text)=>messages.push({jid,text})});return {store,messages,send:(jid,text)=>handler({jid,phoneJid:jid,text})};}
test('ticket numerado, uma solicitação por cliente, sem expor outro atendimento',async()=>{
 const f=fixture();try{await f.send('a','/suporte');await f.send('a','/suporte');await f.send('b','/suporte');assert.equal(f.store.supportPage().total,2);assert.equal(f.store.currentSupport('a').id,1);assert.equal(f.store.currentSupport('b').id,2);assert.ok(f.messages.some(m=>m.jid==='a'&&m.text.includes('#000001')&&m.text.includes('1º')));
 await f.send('a','/minhafila 000002');assert.ok(f.messages.at(-1).text.includes('#000001'));await f.send('a','/chamar');assert.equal(f.store.supportTicket(1).state,'waiting');assert.match(f.messages.at(-1).text,/reservado/);
 }finally{f.store.close();}
});
test('chamada FIFO e cancelamento avisam nova posição aos clientes restantes',async()=>{
 const f=fixture();try{for(const jid of ['a','b','c'])await f.send(jid,'/suporte');f.messages.length=0;await f.send('owner','/chamar');assert.equal(f.store.supportTicket(1).state,'called');assert.ok(f.messages.some(m=>m.jid==='a'&&m.text.includes('Sua vez chegou')));assert.ok(f.messages.some(m=>m.jid==='b'&&m.text.includes('1º')));assert.ok(f.messages.some(m=>m.jid==='c'&&m.text.includes('2º')));
 await f.send('b','/sairdafila');assert.equal(f.store.supportTicket(2).state,'cancelled');assert.equal(f.store.supportPosition(f.store.supportTicket(3)),1);assert.ok(f.messages.some(m=>m.jid==='c'&&m.text.includes('1º')));
 }finally{f.store.close();}
});
test('status de atendimento e conclusão são autorizados, idempotentes e permitem nova senha',async()=>{
 const f=fixture();try{await f.send('a','/suporte');await f.send('owner','/assumir 000001');assert.equal(f.store.supportTicket(1).state,'active');await f.send('owner','/aguardar #000001');assert.equal(f.store.supportTicket(1).state,'waiting_customer');await f.send('a','/minhafila');assert.match(f.messages.at(-1).text,/Aguardando sua resposta/);await f.send('owner','/concluir 000001');assert.equal(f.store.supportTicket(1).state,'closed');let old=f.messages.filter(m=>m.jid==='a').length;await f.send('owner','/concluir 000001');assert.equal(f.messages.filter(m=>m.jid==='a').length,old);await f.send('a','/suporte');assert.equal(f.store.currentSupport('a').id,2);
 }finally{f.store.close();}
});
test('número e fila sobrevivem à reabertura do banco e simulador continua isolado',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tk-support-'));let s=new Store(join(dir,'test.sqlite3'));try{s.openSupport('a','a');s.close();s=new Store(join(dir,'test.sqlite3'));assert.equal(s.currentSupport('a').id,1);assert.equal(s.openSupport('b','b').ticket.id,2);const sim=new Simulator();try{let view=await sim.message('/suporte');assert.ok(view.messages.some(m=>m.text.includes('#000001')));assert.equal(s.supportPage().total,2);await sim.message('/chamar','admin');view=sim.view();assert.ok(view.messages.some(m=>m.audience==='customer'&&m.text.includes('Sua vez chegou')));}finally{await sim.close();}}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
