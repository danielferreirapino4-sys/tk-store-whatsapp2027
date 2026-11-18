import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,confirm} from '../src/store.js';
import {createHandler} from '../src/handler.js';
const product={name:'Teste',cents:1000};
test('cliques simultâneos e confirmação repetida não duplicam envio',async()=>{
 const s=new Store(':memory:'); const o=s.create('cliente',product,'compra');let sent=0;
 const send=async()=>{sent++;await new Promise(r=>setTimeout(r,5));};
 await Promise.all([confirm(s,o.id,send),confirm(s,o.id,send)]);
 await confirm(s,o.id,send);assert.equal(sent,1);assert.equal(s.get(o.id).state,'sent');s.close();
});
test('falha ambígua bloqueia novas tentativas automáticas',async()=>{
 const s=new Store(':memory:');const o=s.create('cliente',product,'compra');let sent=0;
 const send=async()=>{sent++;throw Error('timeout');};
 await confirm(s,o.id,send);await confirm(s,o.id,send);assert.equal(sent,1);assert.equal(s.get(o.id).state,'uncertain');s.close();
});
test('cliente não consegue confirmar o próprio pagamento',async()=>{
 const s=new Store(':memory:');const o=s.create('cliente',product,'compra');const out=[];
 const h=createHandler({store:s,adminJid:'admin',send:async(j,t)=>out.push([j,t]),shopUrl:'loja'});
 await h({jid:'cliente',phoneJid:'cliente',text:'/pago '+o.id});assert.equal(s.get(o.id).state,'pending');assert.equal(out.length,1);assert.match(out[0][1],/reservado/);s.close();
});
test('pedido repetido mantém ID e renovação não promete ativação concluída',async()=>{
 const s=new Store(':memory:');const a=s.create('cliente',product,'renovacao');const b=s.create('cliente',product,'renovacao');assert.equal(a.id,b.id);
 let text;await confirm(s,a.id,async(j,t)=>{text=t;});assert.match(text,/Aguarde sua ativação/);assert.doesNotMatch(text,/Renovação concluída/);s.close();
});
test('somente responsável ajusta valor e cliente recebe o valor final',async()=>{
 const s=new Store(':memory:');const o=s.create('cliente',product,'compra');const out=[];
 const h=createHandler({store:s,adminJid:'admin',send:async(j,t)=>out.push([j,t]),shopUrl:'loja'});
 await h({jid:'cliente',phoneJid:'cliente',text:`/valor ${o.id} 1,00`});assert.equal(s.get(o.id).cents,1000);
 await h({jid:'admin',phoneJid:'admin',text:`/valor ${o.id} 20,00`});assert.equal(s.get(o.id).cents,2000);assert.ok(out.some(([j,t])=>j==='cliente'&&t.includes('20,00')));s.close();
});
