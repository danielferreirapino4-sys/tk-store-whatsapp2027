import {mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.js';
import {Manager} from './manager.js';
import {adapter} from './whatsapp.js';
import {makeServer} from './http.js';
const dir=process.env.DATA_DIR||'./data';
mkdirSync(dir,{recursive:true,mode:0o700});
const store=new Store(join(dir,'orders.sqlite3'));
const manager=new Manager({dir,store,adapter,shopUrl:process.env.SHOP_URL||'https://tkplaytv.tkplaytv9.chatgpt.site/'});
let server;
try{
 server=makeServer({manager,store,password:process.env.PANEL_PASSWORD,htmlPath:join(dirname(fileURLToPath(import.meta.url)),'painel.html')});
 server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>{
  console.log('Painel TK STORE ativo. Abra a URL do serviço e entre com a senha configurada.');
  manager.restore().catch(()=>console.error('Não foi possível restaurar a sessão. Abra o painel para conectar.'));
 });
}catch(error){console.error(error.message);process.exit(1);}
let stopping=false;
async function stop(){if(stopping)return;stopping=true;server.close();await manager.close();store.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
