# TK STORE — painel organizado por páginas · versão 1.4 · bot xirax 6.1

Nova versão com painel no navegador: informe o número do bot e o número do responsável, gere o código e digite-o no WhatsApp. Código, estado da conexão e pedidos ficam protegidos por senha. Não precisa colocar telefones no JavaScript nem procurar códigos nos logs.

## Menu clicável e teste por dispositivo
O menu principal agora oferece TV / Smart TV, Celular e Outros dispositivos. O formulário conversacional suporta TV, celular, tablet, computador/notebook, TV Box, console, projetor e outro aparelho.

Fluxos:
- Cliente escreve /teste ou uma solicitação como “Olá, quero um teste”: pede primeiro o nome, depois dispositivo, marca, modelo/linha e confirmação.
- Cliente toca em TV ou Celular no menu: abre as marcas desse dispositivo, depois os modelos/linhas e pede o nome antes de confirmar.
- /dispositivos abre a lista completa de tipos de aparelho.
- “Outra marca / digitar”, “Digitar outro modelo” e “Não sei o modelo” permitem identificar aparelhos fora dos exemplos. As listas são exemplos de identificação, não garantia de suporte ou licença. Modelos desconhecidos ficam indicados para o atendimento conferir.
- Enviar solicitação salva o protocolo T000001 e avisa o responsável com nome, aparelho, marca e modelo. Não ativa teste, não cria acesso e não confirma compatibilidade.
- /testes lista solicitações pendentes para o responsável. /encerrarteste T000001 encerra o registro depois do atendimento, sem ativação automática.
- /cancelarteste cancela somente o formulário ainda em preenchimento; /start ou /menu volta ao menu. Para mudar uma solicitação já enviada, falar com o suporte.

As escolhas são serializadas como listas native-flow pelo SDK Baileys instalado. Sua exibição e aceitação dependem da versão do WhatsApp e do suporte da conexão não oficial. O servidor envia também o texto com opções numeradas, para continuar o atendimento se o cartão interativo não aparecer. Não foi feito pareamento ou envio real nesta atualização. O simulador do painel renderiza os botões e usa os mesmos identificadores e regras.

Os modelos/linhas de exemplo ficam em devices.js. Cadastre modelos específicos usados pela loja nesse arquivo. Nenhum catálogo representa todos os modelos existentes. Rascunhos ficam em SQLite e expiram após 24 horas de inatividade. Solicitações completas ficam salvas para o responsável e não são duplicadas enquanto houver uma pendente para o cliente.

**Aplicar:** envie todos os arquivos deste ZIP para a pasta principal do repositório. Os novos arquivos essenciais são interactive.js, devices.js e device-flow.js. Também foram atualizados handler.js, store.js, manager.js, whatsapp.js, simulator.js e painel.html. Faça uma única implantação com todos os arquivos. O comando permanece node server.js.

## Fila de atendimento — xirax 6.1 · TKPLAYTV
Esta atualização cria suporte com números sequenciais a partir de #000001. Os números são gerados quando o cliente pede atendimento, não antecipadamente.
- Cliente: /suporte ou opção 8 abre atendimento. Repetir mantém o mesmo número aberto. Pode acrescentar motivo: /suporte problema na TV.
- /minhafila consulta o atendimento mais recente do próprio cliente, posição e status.
- /sairdafila cancela o atendimento aberto e atualiza a posição dos demais.
- Responsável: /fila (ou /fila 2) lista atendimentos em páginas de 20. /chamar chama o primeiro aguardando, seguindo a ordem dos números.
- /assumir NUMERO coloca em atendimento. /aguardar NUMERO marca como aguardando resposta do cliente. /concluir NUMERO finaliza.
- /cancelaratendimento NUMERO MOTIVO cancela e informa o motivo. /atendimento NUMERO consulta detalhes e link da conversa quando o número puder ser identificado.
- O cliente recebe aviso ao mudar de status e quando sua posição avança. Mensagens fora dos comandos não alteram automaticamente o status nem substituem o atendimento humano. Não há estimativa de espera automática.
- Ninguém consegue consultar ou alterar o atendimento de outro cliente usando comandos de cliente. Os comandos administrativos são restritos ao WhatsApp responsável configurado.
- A fila é guardada no mesmo banco SQLite da loja. Uma tabela nova é criada sem apagar pedidos existentes. Precisa de disco persistente no Render para sobreviver à perda de arquivos do servidor.
- Se um aviso falhar, o responsável recebe alerta e deve conferir a conversa; não há repetição automática indiscriminada.
- /versao mostra xirax 6.1; /dono mostra TKPLAYTV. O painel da loja continua identificado como TK STORE.

Para aplicar esta atualização de fila, substitua store.js, handler.js e catalog.js e adicione support.js. Substitua painel.html para mostrar os novos comandos de ajuda. Faça uma única implantação com todos esses arquivos. O comando permanece node server.js.

## Testar bot sem outro número
A página **Testar bot** é uma conversa simulada, não um número de telefone real. Não recebe SMS, não usa serviços de números virtuais, não contorna cadastro no WhatsApp e não envia mensagens reais. Funciona mesmo que a sessão WhatsApp esteja desconectada.
1. Abra Testar bot no menu do painel.
2. Toque em Abrir menu ou envie /start.
3. Envie 1 para abrir o streaming, /comprar 01 para compra ou /renovar 01 para renovação.
4. Os pedidos aparecem no quadro Pedidos de teste. Toque em Simular Pix confirmado para verificar a mensagem que o cliente receberia.
5. Os avisos do responsável aparecem ao lado. Reiniciar teste apaga somente os dados simulados.

Usa o mesmo handler.js e catálogo do bot, com um banco separado em memória e transporte de mensagens local. Cada login tem seu próprio teste, sem compartilhamento de conversa entre logins. Sair, expirar o login ou reiniciar o processo apaga o teste. Mostra até 20 pedidos recentes e mantém até 120 mensagens. Não valida entrega real, compatibilidade de pareamento ou pagamento bancário.

## Atualizar o painel já conectado
Substitua no GitHub os arquivos painel.html e http.js e adicione simulator.js. Se ainda estiver na versão inicial, substitua também store.js. O pacote completo inclui todos esses arquivos na pasta principal. Os outros arquivos do pacote permitem uma instalação completa. O Start Command continua node server.js, e a senha continua em PANEL_PASSWORD no ambiente. Faça Deploy latest commit no Render e atualize a página do painel. Não cole o HTML dentro do bot.js.

A atualização não migra nem apaga tabelas do banco. Em hospedagem sem disco persistente, uma nova implantação pode perder a sessão e os pedidos pelo funcionamento do próprio ambiente; nesse caso, pareie novamente pelo painel. Antes de operar continuamente, configure armazenamento persistente.

## Novas páginas
- Início: resumo com contagens reais de pedidos e atalhos por categoria.
- WhatsApp: formulário e código de pareamento.
- Pedidos: busca, filtro por serviço e estado, até 8 pedidos por página, indicação Página X de Y. Inclui histórico de confirmações enviadas.
- Serviços: categorias com quantidade de serviços e páginas, até 6 serviços por página, busca e comandos de compra. Cada serviço mostra o total de pedidos e pendências.
- Testar bot: conversa, pedidos e confirmação de pagamento simulados, sem outro número.
- Suporte: quatro cartões grandes para contato com o responsável, conexão, pedidos e comandos; perguntas frequentes.

As contagens de páginas são calculadas a partir dos dados reais, não são valores fixos. Os contadores não representam licenças ou vagas de estoque. Não foi adicionado sistema de chamados; o suporte abre o WhatsApp do responsável cadastrado.

## Aplicar no Render que você já criou
1. Extraia TK_STORE_Painel.zip no celular.
2. No GitHub, envie TODOS os arquivos extraídos para a pasta principal do repositório usado pelo serviço. Mantenha os arquivos juntos. Não envie apenas o ZIP. Esta versão não tem pasta src e não usa bot.js.
3. Substitua package.json e package-lock.json pelos novos arquivos. Se ficar um bot.js antigo no repositório, ele não será usado com o comando abaixo.
4. No Render, mantenha o tipo Web Service e o runtime Node.
5. Settings > Build Command: npm ci
6. Settings > Start Command: node server.js
7. Environment: cadastre PANEL_PASSWORD com uma senha forte e exclusiva de pelo menos 12 caracteres. Não coloque a senha no GitHub, no código, em captura de tela ou nesta conversa.
8. Cadastre NODE_VERSION=24.22.1. Para salvar sessões em disco persistente, monte o disco em /data e cadastre DATA_DIR=/data. SHOP_URL pode ser a URL da sua loja; se omitida, usa a loja já informada.
9. Salve e faça Manual Deploy > Deploy latest commit.
10. Abra a URL onrender.com do próprio serviço. Entre com a senha configurada em PANEL_PASSWORD.
11. Preencha o NOVO número de WhatsApp de teste, com DDI e DDD, e o número do responsável. São diferentes. Os campos aceitam espaços, parênteses e hífen.
12. Toque em Gerar código de conexão. No WhatsApp do número do bot, entre em Aparelhos conectados > Conectar aparelho > Conectar com número de telefone. Digite o código exibido no painel. O nome exato do botão pode variar conforme o aplicativo.
13. Aguarde o painel mostrar Conectado. De outro WhatsApp, envie /start para testar o menu.

O servidor abre a porta PORT do Render em 0.0.0.0. Mesmo quando o WhatsApp desconecta, o painel continua ativo. A rota de verificação é /healthz.

## Hospedagem e sessão
O plano Free do Render pode servir para um teste breve do painel, mas não oferece disco persistente e pode suspender por inatividade. Sem persistência, uma reinicialização/implantação pode perder o pareamento e os pedidos. Para uso contínuo, use instância paga e disco persistente; confira os valores no Render antes de contratar. O render.yaml incluído descreve uma implantação paga com disco, como alternativa à configuração manual. Não contratamos nem publicamos nada por este pacote.

Use apenas uma instância por pasta de dados. Não execute simultaneamente o bot antigo e este painel com o mesmo número. Esta versão usa sua própria sessão; não copia nem altera credenciais da Zumy. O diretório DATA_DIR guarda credenciais, pedidos e os números selecionados: restrinja acesso e faça backup seguro. Nunca envie esse diretório ao GitHub. Use repositório privado.

## Atendimento e pagamento
- /start abre o menu. Os comandos de vendas são os mesmos da versão anterior: /comprar CÓDIGO e /renovar CÓDIGO.
- O responsável recebe avisos de pedidos no seu WhatsApp pessoal; /admin mostra os comandos disponíveis.
- O painel mostra pedidos pendentes e permite Confirmar Pix recebido, somente depois de você conferir o banco.
- Mensagem de compra: “✅ Compra efetuada com sucesso! Aguarde sua ativação.”
- Renovação: “✅ Pagamento da renovação confirmado! Aguarde sua ativação.” Não promete serviço já ativado.
- O bot não reconhece pagamentos automaticamente, não gera Pix, não confirma comprovantes e não entrega acessos. A loja é um link, ainda sem sincronização de pedidos.
- Se o valor da renovação/ativação for diferente, use /valor ID 20,00 pelo WhatsApp do responsável antes de confirmar.
- Disponibilidade, duração e condições são confirmadas antes de pagar. Preços com inconsistências e promoção antiga não foram ativados.
- Pedidos com envio incerto ficam bloqueados para novas tentativas automáticas: confira a conversa antes de responder manualmente.

## Conectar e desconectar
Gerar código cria uma tentativa de sessão nova e isolada para o número informado. Só o celular do WhatsApp autoriza o pareamento. O botão não garante que o WhatsApp aceitará o código.
Parar tentativa encerra a conexão neste servidor, mas pode deixar o aparelho listado no aplicativo. Desconectar WhatsApp solicita a saída da sessão atualmente conectada. O painel exige desconectar antes de trocar um número já conectado.
O código é privado, exibido somente após login e não é escrito nos logs. Ele some ao conectar e é ocultado após dois minutos no painel; o WhatsApp pode recusá-lo ou expirá-lo antes. Se houver recusa, pare a tentativa e gere outro.

## Tecnologia e limites
A conexão continua usando Baileys, biblioteca comunitária não oficial, fixada em 7.0.0-rc14. O painel melhora a configuração, mas não transforma o pareamento em uma API oficial nem elimina limitações/restrições do WhatsApp. Use seu número de teste primeiro. A sessão em múltiplos arquivos serve à primeira versão de instância única; antes de escalar, adote armazenamento de chaves adequado à operação.

O acesso ao painel usa senha do ambiente, cookie HttpOnly/SameSite, proteção CSRF para ações e limite de tentativas de login. Use sempre a URL HTTPS do Render. Quem tiver a senha terá acesso aos códigos e à confirmação dos pedidos. Reiniciar o serviço encerra os logins do painel; a sessão WhatsApp registrada é restaurada se o disco for preservado.

## Testes realizados
Testes locais com transporte simulado: validação de números diferentes; geração do código; transição para conectado; sessão encerrada; resposta atrasada após cancelar; bloqueio de acesso sem senha; proteção CSRF; confirmação de pedido somente conectado; envio duplicado e falha ambígua. Syntax/importação do SDK também verificados. Não houve pareamento real com seu WhatsApp nem implantação em sua conta Render.

Para testar localmente: Node >=22.13, npm ci, definir PANEL_PASSWORD no ambiente e executar npm start. Abra http://localhost:3000. Testes: npm test. Não há senha padrão.

Referências: https://render.com/docs/web-services · https://render.com/docs/disks · https://render.com/docs/free · https://github.com/WhiskeySockets/docs/blob/main/authentication/pairing-code.mdx

Validação da versão 1.4 · bot xirax 6.1: paginação e filtros testados com 20 pedidos, sem lacunas ou duplicatas; resumo de estados verificado; navegação, busca e suporte verificados com DOM simulado. Não houve implantação na conta do usuário nesta atualização.

Validação do simulador: testes confirmam isolamento do banco real, nenhum envio pelo transporte real, bloqueio de confirmação pelo cliente, separação entre logins, reset isolado e fluxo completo de compra pelo DOM.

Validação da fila: testes de números sequenciais e persistência, ausência de duplicação, autorização, chamada FIFO, atualização de posições, cancelamento, transições de status e isolamento no simulador. Não implantado na conta do usuário automaticamente.

Validação do fluxo de aparelhos: testes de TV com marca/modelo clicáveis, nome obrigatório, pedido natural de teste, marca e modelo digitados, identificação desconhecida, respostas numéricas por etapa, persistência e cancelamento. DOM: cliques do menu até confirmar solicitação testados. Protobuf da lista native-flow serializado pelo SDK sem envio externo. Exibição real no WhatsApp precisa ser validada após implantação.
