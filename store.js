import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
export class Store {
 constructor(path) {
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,jid TEXT NOT NULL,product TEXT NOT NULL,cents INTEGER NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS seen(id TEXT PRIMARY KEY,created INTEGER NOT NULL);`);
  this.db.exec(`CREATE TABLE IF NOT EXISTS support_tickets(
   id INTEGER PRIMARY KEY AUTOINCREMENT,jid TEXT NOT NULL,identity TEXT NOT NULL,
   state TEXT NOT NULL DEFAULT 'waiting',reason TEXT NOT NULL DEFAULT '',
   created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
   CREATE UNIQUE INDEX IF NOT EXISTS support_one_open ON support_tickets(identity) WHERE state IN ('waiting','called','active','waiting_customer');
   CREATE INDEX IF NOT EXISTS support_queue ON support_tickets(state,id);`);
  this.db.exec(`CREATE TABLE IF NOT EXISTS device_flows(identity TEXT PRIMARY KEY,jid TEXT NOT NULL,step TEXT NOT NULL,data TEXT NOT NULL,updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS trial_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,identity TEXT NOT NULL,jid TEXT NOT NULL,name TEXT NOT NULL,device TEXT NOT NULL,brand TEXT NOT NULL,model TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'requested',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  this.db.exec("UPDATE orders SET state='uncertain' WHERE state='sending'");
 }
 seen(id) { return this.db.prepare('SELECT 1 FROM seen WHERE id=?').get(id)!==undefined; }
 mark(id) { this.db.prepare('INSERT OR IGNORE INTO seen VALUES (?,?)').run(id,Date.now()); }
 create(jid,product,kind) {
  const previous=this.db.prepare("SELECT * FROM orders WHERE jid=? AND product=? AND kind=? AND state='pending'").get(jid,product.name,kind);
  if(previous)return previous;
  const id=randomBytes(6).toString('hex').toUpperCase();
  this.db.prepare('INSERT INTO orders(id,jid,product,cents,kind) VALUES (?,?,?,?,?)').run(id,jid,product.name,product.cents,kind);
  return this.get(id);
 }
 get(id) {return this.db.prepare('SELECT * FROM orders WHERE id=?').get(id);}
 list() {return this.db.prepare("SELECT * FROM orders WHERE state!='sent' ORDER BY created DESC LIMIT 20").all();}
 page({page=1,pageSize=8,state='open',product='',search=''}={}) {
  pageSize=Math.max(1,Math.min(20,Number.parseInt(pageSize)||8));
  const clauses=[],args=[];
  if(state==='open')clauses.push("state!='sent'");
  else if(['pending','sent','uncertain','sending'].includes(state)){clauses.push('state=?');args.push(state);}
  else if(state!=='all')throw Error('Filtro de estado inválido.');
  if(product){clauses.push('product=?');args.push(String(product).slice(0,200));}
  if(search){clauses.push('(product LIKE ? OR id LIKE ?)');const term='%'+String(search).slice(0,100)+'%';args.push(term,term);}
  const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
  const total=this.db.prepare('SELECT COUNT(*) AS n FROM orders'+where).get(...args).n;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));page=Math.max(1,Math.min(totalPages,Number.parseInt(page)||1));
  const orders=this.db.prepare('SELECT * FROM orders'+where+' ORDER BY created DESC,rowid DESC LIMIT ? OFFSET ?').all(...args,pageSize,(page-1)*pageSize);
  return {orders,page,pageSize,total,totalPages};
 }
 summary() {
  const states=this.db.prepare('SELECT state,COUNT(*) AS count FROM orders GROUP BY state').all();
  const byProduct=this.db.prepare(`SELECT product,COUNT(*) AS total,SUM(CASE WHEN state='pending' THEN 1 ELSE 0 END) AS pending FROM orders GROUP BY product`).all();
  const counts={total:0,pending:0,sent:0,uncertain:0,sending:0};
  for(const row of states){counts[row.state]=row.count;counts.total+=row.count;}
  return {...counts,byProduct};
 }
 claim(id) {return this.db.prepare("UPDATE orders SET state='sending' WHERE id=? AND state='pending'").run(id).changes===1;}
 finish(id,state) {if(!['sent','uncertain'].includes(state))throw Error('Estado inválido'); this.db.prepare('UPDATE orders SET state=? WHERE id=?').run(state,id);}
 openSupport(jid,identity,reason='') {
  const old=this.currentSupport(identity);if(old)return {ticket:old,created:false};
  const result=this.db.prepare('INSERT INTO support_tickets(jid,identity,reason) VALUES (?,?,?)').run(jid,identity,reason.slice(0,500));
  return {ticket:this.supportTicket(Number(result.lastInsertRowid)),created:true};
 }
 currentSupport(identity){return this.db.prepare("SELECT * FROM support_tickets WHERE identity=? AND state IN ('waiting','called','active','waiting_customer') ORDER BY id DESC LIMIT 1").get(identity);}
 latestSupport(identity){return this.db.prepare('SELECT * FROM support_tickets WHERE identity=? ORDER BY id DESC LIMIT 1').get(identity);}
 supportTicket(id){return this.db.prepare('SELECT * FROM support_tickets WHERE id=?').get(id);}
 supportPosition(ticket){if(ticket.state!=='waiting')return null;return this.db.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE state='waiting' AND id<=?").get(ticket.id).n;}
 supportWaiting(){return this.db.prepare("SELECT * FROM support_tickets WHERE state='waiting' ORDER BY id").all();}
 supportPage(page=1){
  const total=this.db.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE state IN ('waiting','called','active','waiting_customer')").get().n;
  const totalPages=Math.max(1,Math.ceil(total/20));page=Math.max(1,Math.min(totalPages,Number.parseInt(page)||1));
  const tickets=this.db.prepare("SELECT * FROM support_tickets WHERE state IN ('waiting','called','active','waiting_customer') ORDER BY id LIMIT 20 OFFSET ?").all((page-1)*20);
  return {tickets,total,page,totalPages};
 }
 changeSupport(id,state){
  const t=this.supportTicket(id);if(!t)throw Error('Atendimento não encontrado.');
  const allowed={waiting:['called','active','cancelled'],called:['active','waiting_customer','closed','cancelled'],active:['waiting_customer','closed','cancelled'],waiting_customer:['active','closed','cancelled']};
  if(t.state===state)return {ticket:t,changed:false};
  if(!allowed[t.state]?.includes(state))throw Error('Esse atendimento não permite esta mudança de status.');
  this.db.prepare('UPDATE support_tickets SET state=?,updated=CURRENT_TIMESTAMP WHERE id=?').run(state,id);
  return {ticket:this.supportTicket(id),changed:true};
 }
 deviceFlow(identity){const row=this.db.prepare('SELECT * FROM device_flows WHERE identity=?').get(identity);if(!row)return null;if(Date.now()-row.updated>86400000){this.clearDeviceFlow(identity);return null;}return {...row,data:JSON.parse(row.data)};}
 saveDeviceFlow(identity,jid,step,data){this.db.prepare('INSERT INTO device_flows(identity,jid,step,data,updated) VALUES (?,?,?,?,?) ON CONFLICT(identity) DO UPDATE SET jid=excluded.jid,step=excluded.step,data=excluded.data,updated=excluded.updated').run(identity,jid,step,JSON.stringify(data),Date.now());}
 clearDeviceFlow(identity){this.db.prepare('DELETE FROM device_flows WHERE identity=?').run(identity);}
 openTrial(identity,jid,data){
  const old=this.db.prepare("SELECT * FROM trial_requests WHERE identity=? AND state='requested' ORDER BY id DESC LIMIT 1").get(identity);
  if(old)return {request:old,created:false};
  const result=this.db.prepare('INSERT INTO trial_requests(identity,jid,name,device,brand,model) VALUES (?,?,?,?,?,?)').run(identity,jid,data.name,data.device,data.brand,data.model);
  return {request:this.db.prepare('SELECT * FROM trial_requests WHERE id=?').get(Number(result.lastInsertRowid)),created:true};
 }
 trialRequests(){return this.db.prepare("SELECT * FROM trial_requests WHERE state='requested' ORDER BY id LIMIT 100").all();}
 closeTrial(id){return this.db.prepare("UPDATE trial_requests SET state='closed' WHERE id=? AND state='requested'").run(id).changes===1;}
 close(){this.db.close();}
}
export async function confirm(store,id,send) {
 const order=store.get(id);
 if(!order)return 'Pedido não encontrado.';
 if(!store.claim(id))return `Pedido ${id}: ${order.state}. Não houve novo envio.`;
 const text=order.kind==='renovacao'?'✅ Pagamento da renovação confirmado!\nAguarde sua ativação.':'✅ Compra efetuada com sucesso!\nAguarde sua ativação.';
 try {await send(order.jid,text);store.finish(id,'sent');return `Pedido ${id}: confirmação enviada ao WhatsApp.`;}
 catch {store.finish(id,'uncertain');return `Pedido ${id}: envio sem confirmação. Confira a conversa antes de reenviar manualmente; não repetirei automaticamente.`;}
}
