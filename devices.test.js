import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from './store.js';
import {Simulator} from './simulator.js';
import {createHandler} from './handler.js';
import {extractText} from './interactive.js';
function latest(sim){return [...sim.view().messages].reverse().find(m=>m.audience==='customer'&&m.options)?.options;}
async function choose(sim,label){const option=latest(sim).find(o=>o.title===label);assert.ok(option,'Opção não encontrada: '+label);await sim.message(option.id);}
test('TV clicável coleta marca, modelo e nome e só registra teste após confirmação',async()=>{
 const sim=new Simulator();try{
  await sim.message('/start');await choose(sim,'TV / Smart TV');await choose(sim,'Samsung');await choose(sim,'Crystal UHD');assert.equal(sim.store.trialRequests().length,0);await sim.message('Daniel');await choose(sim,'Enviar solicitação');const request=sim.store.trialRequests()[0];assert.equal(request.name,'Daniel');assert.equal(request.brand,'Samsung');assert.equal(request.model,'Crystal UHD');assert.equal(request.device,'TV / Smart TV');assert.ok(sim.view().messages.some(m=>m.audience==='admin'&&m.text.includes('Novo teste T000001')));assert.ok(sim.view().messages.some(m=>m.text.includes('depende da compatibilidade')));
  await sim.message('/teste');assert.equal(sim.store.trialRequests().length,1);
 }finally{await sim.close();}
});
test('pedido natural de teste pede nome; marca e modelo fora da lista podem ser digitados',async()=>{
 const sim=new Simulator();try{
  await sim.message('Olá quero um teste');assert.match(sim.view().messages.at(-1).text,/qual é o seu nome/);await sim.message('Ana');await choose(sim,'Celular');await choose(sim,'Outra marca / digitar');await sim.message('Marca de teste');await choose(sim,'Digitar outro modelo');await sim.message('Modelo especial 123');await choose(sim,'Enviar solicitação');const r=sim.store.trialRequests()[0];assert.equal(r.name,'Ana');assert.equal(r.brand,'Marca de teste');assert.equal(r.model,'Modelo especial 123');
 }finally{await sim.close();}
});
test('seleção numérica funciona por fase sem confundir opção 8 com suporte',async()=>{
 const sim=new Simulator();try{await sim.message('/teste');await sim.message('Marina');await sim.message('8');assert.equal(sim.store.deviceFlow(sim.customer).step,'custom_device');assert.equal(sim.store.supportPage().total,0);await sim.message('Receptor');await sim.message('Minha marca');await choose(sim,'Não sei o modelo');await choose(sim,'Enviar solicitação');assert.equal(sim.store.trialRequests()[0].device,'Receptor');}finally{await sim.close();}
});
test('rascunho sobrevive à reabertura do banco e cancelar não notifica responsável',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tk-device-'));let s=new Store(join(dir,'db'));const out=[];
 try{let h=createHandler({store:s,adminJid:'admin',send:async(j,t)=>out.push([j,t]),shopUrl:'https://example.test'});await h({jid:'a',phoneJid:'a',text:'/teste'});await h({jid:'a',phoneJid:'a',text:'João'});s.close();s=new Store(join(dir,'db'));assert.equal(s.deviceFlow('a').data.name,'João');h=createHandler({store:s,adminJid:'admin',send:async(j,t)=>out.push([j,t]),shopUrl:'https://example.test'});await h({jid:'a',phoneJid:'a',text:'/cancelarteste'});assert.equal(s.deviceFlow('a'),null);assert.equal(s.trialRequests().length,0);assert.equal(out.filter(([j])=>j==='admin').length,0);}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('respostas de listas, botões e native-flow são interpretadas com segurança',()=>{
 assert.equal(extractText({listResponseMessage:{singleSelectReply:{selectedRowId:'/teste'}}}),'/teste');assert.equal(extractText({buttonsResponseMessage:{selectedButtonId:'/tv'}}),'/tv');assert.equal(extractText({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{"id":"xirax:trial:confirm"}'}}}),'xirax:trial:confirm');assert.equal(extractText({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{bad'}}}),'');
});
