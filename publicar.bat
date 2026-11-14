@echo off
chcp 65001 >nul
title Publicar nova versao do Clima
cd /d "%~dp0"

echo.
echo  Antes de publicar, suba o numero de "version" no package.json
echo  (por exemplo de 0.4.1 para 0.4.2) e salve.
echo.

if "%GH_TOKEN%"=="" (
  echo  Cole o token do GitHub (https://github.com/settings/tokens, classic, permissao repo).
  echo  Ele vale so para esta janela e nao e salvo.
  set /p GH_TOKEN=Token: 
)

call npm install --no-audit --no-fund
if errorlevel 1 goto erro

call npm run publish
if errorlevel 1 goto erro

echo.
echo  Publicado! Abra https://github.com/thiagoawks/clima/releases
echo  A versao fica como rascunho (draft): clique em "Publish release" para liberar.
pause
exit /b 0

:erro
echo.
echo  Algo deu errado. Confira o token e a internet.
pause
exit /b 1
