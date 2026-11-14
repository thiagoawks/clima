@echo off
chcp 65001 >nul
title Criando o instalador do Clima
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Baixe a versao LTS em https://nodejs.org, instale e abra este arquivo de novo.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  [1/2] Baixando as dependencias (so demora na primeira vez)...
call npm install --no-audit --no-fund
if errorlevel 1 goto erro

echo.
echo  [2/2] Montando o instalador...
call npm run dist
if errorlevel 1 goto erro

echo.
echo  Pronto! O instalador esta na pasta dist.
start "" "%~dp0dist"
pause
exit /b 0

:erro
echo.
echo  Algo deu errado. Se a mensagem fala de "symbolic link",
echo  clique com o botao direito neste arquivo e escolha "Executar como administrador".
pause
exit /b 1
