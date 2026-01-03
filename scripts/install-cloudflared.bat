@echo off
REM Script de instalação do Cloudflared para Windows (Batch)
REM Execute: scripts\install-cloudflared.bat

echo.
echo 🚀 Instalando Cloudflared...
echo.

REM Verificar se já está instalado
where cloudflared >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo ✅ Cloudflared já está instalado!
    cloudflared --version
    exit /b 0
)

REM Criar diretório de instalação
set "INSTALL_DIR=%USERPROFILE%\.cloudflared"
set "EXE_PATH=%INSTALL_DIR%\cloudflared.exe"

REM Verificar se já existe
if exist "%EXE_PATH%" (
    echo ✅ Cloudflared encontrado em: %INSTALL_DIR%
    echo    Adicione ao PATH manualmente se necessário
    exit /b 0
)

REM Criar diretório
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM URL de download
set "DOWNLOAD_URL=https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
set "DOWNLOAD_PATH=%TEMP%\cloudflared-windows-amd64.exe"

echo 📥 Baixando Cloudflared...
echo    URL: %DOWNLOAD_URL%
echo.

REM Baixar usando PowerShell
powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%DOWNLOAD_PATH%' -UseBasicParsing"

if not exist "%DOWNLOAD_PATH%" (
    echo ❌ Erro ao baixar Cloudflared
    echo.
    echo 📥 Download manual:
    echo    1. Acesse: https://github.com/cloudflare/cloudflared/releases
    echo    2. Baixe: cloudflared-windows-amd64.exe
    echo    3. Renomeie para: cloudflared.exe
    echo    4. Coloque em: %INSTALL_DIR%
    exit /b 1
)

echo ✅ Download concluído!
echo.

echo 📦 Instalando...
move /Y "%DOWNLOAD_PATH%" "%EXE_PATH%" >nul

if not exist "%EXE_PATH%" (
    echo ❌ Erro ao instalar
    exit /b 1
)

echo ✅ Instalação concluída!
echo    Localização: %EXE_PATH%
echo.

REM Adicionar ao PATH (requer PowerShell)
echo 🔧 Adicionando ao PATH...
powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';%INSTALL_DIR%', 'User')"

echo ✅ Adicionado ao PATH!
echo.
echo 🎉 Cloudflared instalado com sucesso!
echo.
echo ⚠️  IMPORTANTE:
echo    Reinicie o terminal para usar o comando 'cloudflared'
echo    Ou use o caminho completo: %EXE_PATH%
echo.
echo 💡 Teste a instalação:
echo    %EXE_PATH% --version
echo.

pause





































