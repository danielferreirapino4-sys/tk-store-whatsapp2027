import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store,confirm} from './store.js';
import {Manager} from './manager.js';
import {makeServer} from './http.js';
function setup(){const dir=mkdtempSync(join(tmpdir(),'tk-panel-'));const store=new Store(':memory:');let socket;const adapter={async open(){socket={registered:false,onUpdate(fn){this.update=fn;},onMessages(fn){this.messages=fn;},async pair(){return 'TEST1234';},end(){this.ended=true;},async logout(){this.loggedOut=true;},async resolvePhone(j){return j;},async send(){return {key:{id:'real-id'}};},closeReason(u){return u.reason;}};return socket;}};const manager=new Manager({dir,store,adapter,shopUrl:'https://example.com'});return {dir,store,manager,get socket(){return socket;},async cleanup(){await manager.close();store.close();rmSync(dir,{recursive:true,force:true});}};}
test('número validado; código aparece só após evento QR e desaparece ao conectar',async()=>{
 const t=setup();try{
  await assert.rejects(t.manager.pair('abc','5582996813027'));
  await assert.rejects(t.manager.pair('5511960649533','5511960649533'));
  await t.manager.pair('+55 (11) 96064-9533','55 82 99681-3027');assert.equal(t.manager.view().status,'connecting');
  await t.socket.update({qr:'trigger'});assert.equal(t.manager.view().code,'TEST1234');
  await t.socket.update({connection:'open'});assert.equal(t.manager.view().code,null);assert.equal(t.manager.view().status,'connected');
  await assert.rejects(t.manager.pair('5511958084941','5582996813027'));
 }finally{await t.cleanup();}
});
test('sessão encerrada mantém painel disponível e permite outra tentativa',async()=>{
 const t=setup();try{await t.manager.pair('5511960649533','5582996813027');await t.socket.update({connection:'close',reason:'terminal'});assert.equal(t.manager.view().status,'disconnected');await t.manager.pair('5511958084941','5582996813027');assert.equal(t.manager.view().phone,'5511958084941');}finally{await t.cleanup();}
});
test('resposta atrasada de pareamento não reaparece depois de parar',async()=>{
 const t=setup();try{await t.manager.pair('5511960649533','5582996813027');let resolve;t.socket.pair=()=>new Promise(r=>resolve=r);const pending=t.socket.update({qr:'x'});await t.manager.pause();resolve('SECRET');await pending;assert.equal(t.manager.view().code,null);assert.equal(t.manager.view().status,'disconnected');}finally{await t.cleanup();}
});
test('API protege código e pedidos com senha e CSRF; health permanece ativo',async()=>{
 const t=setup();const server=makeServer({manager:t.manager,store:t.store,password:'senha-de-teste-123',htmlPath:new URL('./painel.html',import.meta.url)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
 async function call(path,data,{auth=true,token=true}={}){const headers={};if(auth)headers.Cookie=cookie;if(data!==undefined){headers['Content-Type']='application/json';headers['X-TK-Panel']='1';if(token)headers['X-CSRF-Token']=csrf;}return fetch(base+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data)});}
 try{
  assert.equal((await call('/healthz')).status,200);
  assert.equal((await call('/api/state')).status,401);
  assert.equal((await call('/api/orders')).status,401);
  assert.equal((await call('/api/login',{password:'errada'})).status,401);
  const login=await call('/api/login',{password:'senha-de-teste-123'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];csrf=(await login.json()).csrf;
  assert.equal((await call('/api/connect',{phone:'5511960649533',admin:'5582996813027'},{token:false})).status,403);
  assert.equal((await call('/api/connect',{phone:'5511960649533',admin:'5582996813027'})).status,200);
  await t.socket.update({qr:'trigger'});const state=await (await call('/api/state')).json();assert.equal(state.code,'TEST1234');
  assert.equal((await call('/api/state',undefined,{auth:false})).status,401);
  const o=t.store.create('cliente@s.whatsapp.net',{name:'Produto',cents:1800},'compra');
  assert.equal((await call('/api/confirm',{id:o.id})).status,409);
  await t.socket.update({connection:'open'});let sends=0;t.socket.send=async()=>{sends++;return {key:{id:'sent'}};};
  await call('/api/confirm',{id:o.id});await call('/api/confirm',{id:o.id});assert.equal(sends,1);assert.equal(t.store.get(o.id).state,'sent');
  await call('/api/logout',{});assert.equal((await call('/api/state')).status,401);
 }finally{await new Promise(r=>server.close(r));await t.cleanup();}
});
test('confirmação simultânea só envia uma vez; falha não é repetida',async()=>{
 const s=new Store(':memory:');let sent=0;const o=s.create('cliente',{name:'P',cents:100},'compra');const send=async()=>{sent++;await new Promise(r=>setTimeout(r,5));};await Promise.all([confirm(s,o.id,send),confirm(s,o.id,send)]);assert.equal(sent,1);
 const fail=s.create('cliente',{name:'Outro',cents:100},'compra');let tries=0;const broken=async()=>{tries++;throw Error('timeout');};await confirm(s,fail.id,broken);await confirm(s,fail.id,broken);assert.equal(tries,1);assert.equal(s.get(fail.id).state,'uncertain');s.close();
});
