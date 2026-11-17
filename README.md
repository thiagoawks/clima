# Clima

Controle dos ares-condicionados e da lavadora Samsung pelo SmartThings, no Windows. Fica na bandeja, avisa quando o quarto esquenta, agenda, mede o consumo e se atualiza sozinho.

## Instalar

1. Abra a página de [versões](https://github.com/thiagoawks/clima/releases/latest) e baixe o `Clima-Setup-x.y.z.exe`.
2. Rode o instalador. O Windows pode mostrar um aviso azul do SmartScreen, porque o instalador não é assinado: clique em **Mais informações** e em **Executar assim mesmo**.
3. Quem já tem uma versão antiga instala por cima. Ajustes e histórico ficam guardados.

Depois disso não precisa baixar mais nada: quando sai versão nova, aparece o botão **Atualizar** na barra de título.

## Conectar ao SmartThings

1. No Clima, clique em **Conectar SmartThings**.
2. Clique em **Abrir o site**, entre com a conta Samsung dos aparelhos e gere um token, marcando pelo menos Dispositivos e Locais.
3. Copie o token e clique em **Colar e conectar**.

O token vale 24 horas. O Clima avisa antes de expirar e renovar leva meio minuto. O token fica só no computador, criptografado pelo Windows.

### A cobrança da Samsung

Em novembro de 2026 a Samsung passou a cobrar pelo acesso permanente à API do SmartThings. O token gratuito de 24 horas tem fim anunciado para 15/12/2026 ([aviso da Samsung](https://blog.smartthings.com/smartthings-updates/smartthings-api-additional-details-for-developers-and-business-partners/)). Depois dessa data, o Clima só funciona para quem assinar o plano de desenvolvedor da Samsung.

Com o plano ativo, o login passa a ser permanente:

1. No terminal: `npx @smartthings/cli@2 apps:create`
2. Tipo **OAuth-In App**, scopes de dispositivos e locais, Redirect URI `https://localhost/clima`.
3. Em Configurações → Conta SmartThings → "Tenho o plano de desenvolvedor", cole o Client ID e o Client Secret e clique em **Entrar com a Samsung**.

## O que o app faz

- **Ares:** ligar, temperatura, modo, ventilador, direção do vento, WindFree, timer de desligar.
- **Cenas:** um clique aplica um ajuste em um ar ou em todos, na tela inicial ou no ícone da bandeja.
- **Boa noite:** liga no Frio na temperatura escolhida, com o modo de sono, e pode desligar sozinho de manhã.
- **Agendamentos:** por horário e dia da semana, com pré-resfriar.
- **Conforto automático:** liga sozinho quando o quarto fica quente ou abafado, cruzando temperatura e umidade.
- **Consumo:** por hora, por dia e por mês, com custo, ritmo do mês, meta de gasto e exportação em planilha.
- **Avisos:** quarto quente, lavadora terminou, filtro para lavar, ar ligado há muitas horas, token perto de expirar.
- **Lavadora:** andamento, hora de terminar, iniciar e pausar (com o Smart Control ligado na máquina).
- **Atalhos globais:** Ctrl+Alt+↑/↓ muda a temperatura, Ctrl+Alt+P liga ou desliga.
- **Mini janela** sempre por cima, tema claro ou escuro, iniciar com o Windows.

Agendamentos, timers e conforto automático rodam com o PC ligado e o Clima aberto, mesmo escondido na bandeja.

## Se algo der errado

Em Configurações → Sobre → **Diagnóstico**, o botão Copiar gera um resumo técnico (sem token nem senha) para colar em quem for ajudar.

## Para desenvolver

```
npm install
npm start
```

Para lançar uma versão, suba o número de `version` no `package.json` e envie para a branch `main`. O GitHub Actions monta o instalador e publica em Releases. Para montar no próprio PC, use `criar-instalador.bat`.

Dados do tempo pelo [Open-Meteo](https://open-meteo.com).
