import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  jidNormalizedUser,
  Browsers
} from '@whiskeysockets/baileys';

import pino from 'pino';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from './store.js';
import { createHandler } from './handler.js';

const dir = process.env.DATA_DIR || './data';
const phone = '5511960649533';
const admin = '5582996813027';

mkdirSync(dir, { recursive: true, mode: 0o700 });

const store = new Store(join(dir, 'orders.sqlite3'));
const adminJid = `${admin}@s.whatsapp.net`;
const log = pino({ level: 'silent' });

let sock;
let stopping = false;
let reconnectTimer;
let queue = Promise.resolve();
let attempt = 0;

async function start() {
  if (stopping) return;

  console.log('Iniciando TK STORE...');

  const { state, saveCreds } = await useMultiFileAuthState(
    join(dir, 'session')
  );

  let pairingRequested = false;

  const current = makeWASocket({
    auth: state,
    logger: log,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock = current;

  current.ev.on('creds.update', saveCreds);

  current.ev.on('connection.update', async (update) => {
    if (stopping || current !== sock) return;

    if (
      update.qr &&
      !state.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        const code = await current.requestPairingCode(phone);
        console.log('Código privado de pareamento TK STORE:', code);
        console.log('Digite no WhatsApp do bot. Não compartilhe.');
      } catch (erro) {
        console.error('Falha ao gerar código:', erro.message);
      }
    }

    if (update.connection === 'open') {
      attempt = 0;
      console.log('TK STORE conectado!');
      console.log('Envie /start de outro WhatsApp.');
      console.log('Responsável: envie /admin ao número do bot.');
    }

    if (update.connection === 'close') {
      const reason =
        update.lastDisconnect?.error?.output?.statusCode;

      if (
        reason === DisconnectReason.loggedOut ||
        reason === DisconnectReason.connectionReplaced
      ) {
        console.error(
          'Sessão encerrada ou substituída. Confira os aparelhos conectados.'
        );
        return;
      }

      clearTimeout(reconnectTimer);

      const wait = Math.min(
        30000,
        1000 * 2 ** Math.min(attempt++, 5)
      );

      console.log(`Conexão encerrada. Nova tentativa em ${wait / 1000}s.`);

      reconnectTimer = setTimeout(() => {
        start().catch((erro) => {
          console.error('Falha ao reconectar:', erro.message);
        });
      }, wait);
    }
  });

  const send = async (jid, text) => {
    if (current !== sock || stopping) {
      throw new Error('Conexão indisponível');
    }

    const sent = await current.sendMessage(jid, { text });

    if (!sent?.key?.id) {
      throw new Error('Envio sem confirmação');
    }
  };

  const handle = createHandler({
    store,
    adminJid,
    send,
    shopUrl:
      process.env.SHOP_URL ||
      'https://tkplaytv.tkplaytv9.chatgpt.site/'
  });

  current.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' || stopping) return;

    for (const m of messages) {
      queue = queue
        .then(async () => {
          if (current !== sock || stopping || m.key.fromMe) return;

          const jid = m.key.remoteJid;

          if (!jid || !/@(s\.whatsapp\.net|lid)$/.test(jid)) return;

          const text =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text;

          if (!text || !m.key.id) return;

          const key = `${jid}:${m.key.id}`;

          if (store.seen(key)) return;
          store.mark(key);

          let phoneJid = jidNormalizedUser(
            m.key.remoteJidAlt || jid
          );

          if (
            jid.endsWith('@lid') &&
            !phoneJid.endsWith('@s.whatsapp.net')
          ) {
            const mapped =
              await current.signalRepository.lidMapping.getPNForLID(jid);

            if (mapped) {
              phoneJid = jidNormalizedUser(mapped);
            }
          }

          await handle({ jid, phoneJid, text });
        })
        .catch((erro) => {
          console.error(
            'Falha ao processar mensagem:',
            erro.message
          );
        });
    }
  });
}

async function stop() {
  if (stopping) return;

  stopping = true;
  clearTimeout(reconnectTimer);

  await queue;
  sock?.end(undefined);
  store.close();

  process.exit(0);
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

start().catch((erro) => {
  console.error('Falha ao iniciar:', erro.message);
  process.exit(1);
});
