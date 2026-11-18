import { Store } from './store.js';
import { createHandler } from './handler.js';

// Ambiente isolado: sem socket, número de telefone, envio externo ou acesso ao banco real.
export class Simulator {
  constructor() {
    this.queue = Promise.resolve();
    this.initialize();
  }
  initialize() {
    this.store = new Store(':memory:');
    this.messages = [];
    this.sequence = 0;
    this.customer = 'cliente@teste.local';
    this.admin = 'responsavel@teste.local';
    this.handler = createHandler({
      store: this.store,
      adminJid: this.admin,
      shopUrl: 'https://loja.exemplo.test/',
      sendChoices: async (jid,payload)=>{this.append('bot',jid===this.admin?'admin':'customer',payload.text,payload.options);},
      send: async (jid, text) => {
        this.append('bot', jid === this.admin ? 'admin' : 'customer', text);
      }
    });
  }
  append(role, audience, text, options) {
    this.sequence++;
    this.messages.push({ role, audience, text, ...(options?{options}:{}), time: Date.now() });
    if (this.messages.length > 120) this.messages.splice(0, this.messages.length - 120);
  }
  view() {
    return {
      simulated: true,
      contact: 'Cliente de teste',
      messages: this.messages,
      orders: this.store.page({ state: 'all', pageSize: 20 }).orders,
      totalOrders: this.store.summary().total
    };
  }
  enqueue(action) {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  async message(text, role = 'customer') {
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      throw new Error('Digite uma mensagem de até 2.000 caracteres.');
    }
    if (!['customer', 'admin'].includes(role)) throw new Error('Papel de teste inválido.');
    return this.enqueue(async () => {
      const jid = role === 'admin' ? this.admin : this.customer;
      const selected=[...this.messages].reverse().flatMap(m=>m.options||[]).find(o=>o.id===text.trim());
      this.append(role, role, selected?selected.title:text.trim());
      const before = this.sequence;
      await this.handler({ jid, phoneJid: jid, text: text.trim() });
      // O bot real ignora mensagens fora dos comandos; deixe isso claro no teste.
      if (this.sequence === before) {
        this.append('system', role, 'O bot não responde automaticamente a esta mensagem. Envie /start para abrir o menu.');
      }
      return this.view();
    });
  }
  async reset() {
    return this.enqueue(() => {
      this.store.close();
      this.initialize();
      return this.view();
    });
  }
  async close() { await this.queue; this.store.close(); }
}
