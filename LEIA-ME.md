# TK STORE — WhatsApp, sem Discord

Versão inicial executável, ainda não hospedada nem pareada com um número real.

## O que funciona
- Cliente envia /start (ou oi): recebe o menu.
- Categorias 1 a 5 mostram catálogo e preços enviados pelo responsável.
- /comprar 01 registra pedido. /renovar 01 registra solicitação de renovação.
- 6 solicita atendimento para teste e 8 solicita suporte.
- O responsável recebe o ID do pedido em seu WhatsApp pessoal.
- /admin lista comandos; /pedidos mostra pendências; /status ID consulta estado.
- /valor ID 20,00 ajusta valor de pedido pendente e avisa o cliente. Use para renovação e diferenças de ativação/licenciamento.
- Após conferir o Pix no banco, o responsável envia /pago ID.
- Cliente recebe “✅ Compra efetuada com sucesso! Aguarde sua ativação.”
- Para renovação: “✅ Pagamento da renovação confirmado! Aguarde sua ativação.” Pagamento não significa que o serviço já foi renovado.
- Somente o número responsável configurado pode confirmar pagamentos. Comandos são recebidos em conversas privadas; grupos e mensagens de status são ignorados.

## Instalar no Render
1. Crie um NOVO repositório privado no GitHub e envie o conteúdo desta pasta, com src, package.json e package-lock.json na raiz. Não use os arquivos Python da versão Discord.
2. No Render escolha New > Background Worker e conecte o novo repositório.
3. Build Command: npm ci
4. Start Command: npm start
5. Configure NODE_VERSION=24.22.1, DATA_DIR=/data e SHOP_URL com o endereço da loja.
6. BOT_PHONE_NUMBER: o NOVO WhatsApp da loja, com DDI e DDD, somente números. ADMIN_PHONE_NUMBER: seu WhatsApp pessoal, diferente do bot, também completo. Nenhum número pessoal foi preenchido automaticamente.
7. Adicione disco persistente em /data. Esta configuração usa worker e disco pagos no Render. Confira os valores exibidos antes de contratar. Use apenas uma instância.
8. Ao iniciar, os logs privados mostram um código de pareamento. No WhatsApp do bot: Aparelhos conectados > Conectar aparelho > Conectar com número de telefone (o rótulo pode variar). Digite o código no aplicativo. Não envie o código em conversas ou capturas públicas.
9. Aguarde “TK STORE conectado”. De outro número, envie /start ao WhatsApp do bot. Pelo número de responsável envie /admin.
10. Faça um pedido de teste e confira destinatário, valor e confirmação antes de usar com clientes.

O render.yaml incluído é uma alternativa à configuração manual. Nada foi contratado ou publicado por este pacote.

## Rodar no computador
Requer Node >=22.13. Copie .env.example para .env, preencha os números e use DATA_DIR=./data. Execute npm ci e npm start. Para testes: npm test.

## Conexão e dados
A conexão por código usa a biblioteca comunitária Baileys, não a API oficial da Meta. Pode sofrer mudanças de compatibilidade, desconexões ou restrições pelo WhatsApp. A opção oficial usa outro processo de configuração e não usa este pareamento. Este pacote usa um número separado e uma pasta de sessão nova: não importa nem altera a sessão da Zumy.

O armazenamento de sessão em múltiplos arquivos é uma solução inicial para uma única instância; antes de ampliar a operação, substitua por um armazenamento de credenciais e chaves adequado à escala. Não publique a pasta data ou arquivos de sessão: eles dão acesso ao WhatsApp conectado. Restrinja acesso ao disco e faça backup seguro. O banco contém destinatários e pedidos.

## Limites e operação
- Pagamento conferido manualmente: o bot não acessa o Mercado Pago nem verifica Pix. Enviar comprovante ou escrever “paguei” não libera confirmação.
- Não gera QR Code ou copia e cola. Instruções de pagamento ficam com o responsável, conforme combinado.
- Link para a loja, sem sincronização automática de pedidos, clientes ou pagamentos.
- Ativação/entrega de acessos pelo atendimento. Não armazena senhas de produtos.
- O bot responde a comandos, não usa IA nem responde automaticamente a toda conversa. O responsável atende pelas conversas do WhatsApp da loja; pedidos chegam ao seu número pessoal sem expor o telefone do cliente no aviso.
- Condições sem prazo informado ficam “a confirmar”. IBO Player comum aguarda resolver a diferença entre R$ 35 e R$ 38. Promoção anual antiga e itens sem configuração validada ficaram fora desta primeira versão.
- Pedidos repetidos do mesmo produto, cliente e tipo reutilizam o pedido pendente.
- Mensagens enviadas são aceitas pelo transporte, sem garantia de leitura/entrega ao aparelho. Uma falha ambígua fica uncertain e não será reenviada automaticamente. Confira a conversa do cliente antes de tratar manualmente. Não há garantia de exatamente uma entrega entre sistemas.
- Mensagens de entrada são registradas antes de processar para evitar duplicatas. Se uma resposta falhar, o responsável deve conferir /pedidos e o cliente pode repetir o comando com uma nova mensagem.
- Esta primeira versão não tem painel web, expiração/cancelamento de pedidos nem retenção automática de dados. Faça gestão e limpeza segura dos registros conforme sua operação.

## Validação realizada
Testes locais: confirmação simultânea/repetida; bloqueio de cliente tentando confirmar pagamento; falha de envio sem repetição; pedido pendente duplicado; mensagem de renovação sem prometer ativação concluída. Importação da biblioteca verificada. Pareamento, mensagens reais e implantação Render ainda precisam de teste com suas contas.

Referências técnicas: https://github.com/WhiskeySockets/Baileys e https://render.com/docs/disks
