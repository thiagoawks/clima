# Clima 0.4

App de Windows para controlar os ares-condicionados e a lavadora Samsung pelo SmartThings.

## Instalar

Dê dois cliques em **`criar-instalador.bat`**. Ele baixa o que precisa, monta o instalador e abre a pasta `dist` com o **`Clima-Setup-0.4.1.exe`**. Rode o instalador por cima da versão antiga: seus ajustes e o histórico ficam guardados.

Se der erro de "symbolic link", clique com o botão direito no `.bat` e escolha **Executar como administrador**.

Para só testar sem instalar: `npm install` e depois `npm start`.

## Login permanente (faça uma vez)

O token pessoal da Samsung vale só 24 horas. Com o login abaixo, o Clima renova o acesso sozinho e você não precisa mais colar nada.

**Jeito fácil (sem terminal):**

1. Abra https://account.smartthings.com/tokens, gere um token e marque **todas** as permissões (inclusive as de Apps).
2. No Clima, abra Configurações → Conta SmartThings, cole o token em "Login permanente (jeito fácil)" e clique em **Configurar**.
3. O Clima cria o app OAuth sozinho, abre o login da Samsung e guarda tudo criptografado. O token temporário não é salvo e pode expirar.

**Jeito manual (se o fácil falhar):** use o CLI da Samsung (`smartthings apps:create`, ou `apps create` nas versões novas), escolha **OAuth-In App**, scopes `r:devices:*`, `x:devices:*`, `r:locations:*` e Redirect URI `https://localhost/clima`. Depois cole o Client ID e o Client Secret em "Já tenho Client ID e Secret" e clique em **Entrar com a Samsung**.

Se a janela de login não funcionar, use **Abrir no navegador**. Depois de autorizar, o navegador vai para um endereço que não carrega (é esperado). Copie esse endereço inteiro, cole no campo "Usou o navegador?" e clique em **Concluir**.

Se o CLI não aceitar `https://localhost/clima`, use qualquer endereço `https://` e coloque o mesmo no Clima. Os dois precisam ser idênticos.

O login só cai se o Clima ficar cerca de um mês sem abrir. Aí é só clicar em **Entrar com a Samsung** de novo.

## O que tem de novo na 0.4

- **Login permanente** (acima).
- **Agendamentos**: ligar ou desligar em horários e dias da semana, por ar ou para todos. Com **pré-resfriar**, o app liga até 45 minutos antes (cerca de 6 minutos por grau de diferença, uma estimativa) para o quarto chegar na temperatura no horário.
- **Conforto automático**, por quarto: liga o ar sozinho quando o quarto fica quente ou abafado. Só desliga sozinho um ar que ele mesmo ligou, quando o quarto está confortável e lá fora a sensação é de 22° ou menos. Se você desligar na mão, ele respeita e fica 2 horas sem mexer.
- **Boa noite**: um clique liga no Frio a 23° com WindFree Sono.
- **Atalhos globais**: Ctrl+Alt+↑ e Ctrl+Alt+↓ mudam a temperatura, Ctrl+Alt+P liga ou desliga. Funcionam em qualquer programa e mostram um aviso pequeno na tela. Em jogos em tela cheia exclusiva o aviso pode não aparecer, mas o comando é enviado.
- **Mini janela**: controle pequeno, sempre por cima. Clique no nome para trocar de ar, e dê dois cliques no fundo para abrir o app.
- **Histórico do quarto**: aba "Quarto" no painel, com a temperatura de hoje por hora.
- **Meta de gasto mensal**: projeção do mês na aba "7 dias" e aviso se for passar da meta.
- **Lavadora**: lembrete de novo 15 e 30 minutos depois do fim, até você marcar "Já tirei".
- Bandeja: "Desligar todos os ares" e liga/desliga da mini janela.

## O que já tinha

Controle completo dos ares (temperatura, modo, ventilador, direção, modos especiais, timer de desligar), sensação térmica com sugestões, dicas que cruzam o quarto com o clima lá fora, consumo por hora e por dia com custo em reais, acompanhamento da lavadora, previsão do tempo, tema claro e escuro, iniciar com o Windows e ícone na bandeja.

## Limites

- Agendamentos, timers, conforto automático e históricos só funcionam com o PC ligado e o Clima aberto (pode estar na bandeja).
- Os nomes dos programas da lavadora ainda não aparecem: a API manda só códigos.
- Não há atualização automática. Para atualizar, rode o instalador da versão nova.

## Atualização automática

O Clima procura versões novas no GitHub (`thiagoawks/clima`) ao abrir e a cada poucas horas. Quando acha uma, aparece o botão **Atualizar** na barra de título. Nada instala sem você clicar. Em Configurações → Sobre tem "Procurar atualização".

Para lançar uma versão: suba o `version` no `package.json`, dê dois cliques em **`publicar.bat`**, cole o token do GitHub (classic, permissão `repo`) e, no site, clique em **Publish release** na versão rascunho. A primeira instalação precisa ser a 0.4.1 ou mais nova, que já traz o atualizador.
