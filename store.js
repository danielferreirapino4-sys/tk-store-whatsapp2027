import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
export class Store {
 constructor(path) {
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,jid TEXT NOT NULL,product TEXT NOT NULL,cents INTEGER NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS seen(id TEXT PRIMARY KEY,created INTEGER NOT NULL);`);
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
 claim(id) {return this.db.prepare("UPDATE orders SET state='sending' WHERE id=? AND state='pending'").run(id).changes===1;}
 finish(id,state) {if(!['sent','uncertain'].includes(state))throw Error('Estado inválido'); this.db.prepare('UPDATE orders SET state=? WHERE id=?').run(state,id);}
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
