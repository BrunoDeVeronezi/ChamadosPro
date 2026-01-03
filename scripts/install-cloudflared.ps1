# Script de instalacao do Cloudflared para Windows
# Execute: powershell -ExecutionPolicy Bypass -File scripts/install-cloudflared.ps1

Write-Host "Instalando Cloudflared..." -ForegroundColor Cyan
Write-Host ""

# Verificar se ja esta instalado
$cloudflaredPath = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cloudflaredPath) {
    Write-Host "Cloudflared ja esta instalado!" -ForegroundColor Green
    Write-Host "Versao: " -NoNewline
    & cloudflared --version
    exit 0
}

# Criar diretorio de instalacao
$installDir = "$env:USERPROFILE\.cloudflared"
$exePath = "$installDir\cloudflared.exe"

# Verificar se ja existe na pasta do usuario
if (Test-Path $exePath) {
    Write-Host "Cloudflared encontrado em: $installDir" -ForegroundColor Green
    Write-Host "Adicionando ao PATH..." -ForegroundColor Yellow
    
    # Adicionar ao PATH do usuario
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$installDir*") {
        $newPath = "$currentPath;$installDir"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Adicionado ao PATH!" -ForegroundColor Green
        Write-Host "Reinicie o terminal para usar o comando 'cloudflared'" -ForegroundColor Yellow
    }
    exit 0
}

# Criar diretorio se nao existir
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# URL de download (Windows 64-bit)
$downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
$downloadPath = "$env:TEMP\cloudflared-windows-amd64.exe"

Write-Host "Baixando Cloudflared..." -ForegroundColor Yellow
Write-Host "URL: $downloadUrl" -ForegroundColor Gray

try {
    # Baixar arquivo
    Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath -UseBasicParsing
    
    Write-Host "Download concluido!" -ForegroundColor Green
    Write-Host ""
    
    # Mover para diretorio de instalacao
    Write-Host "Instalando..." -ForegroundColor Yellow
    Move-Item -Path $downloadPath -Destination $exePath -Force
    
    Write-Host "Instalacao concluida!" -ForegroundColor Green
    Write-Host "Localizacao: $exePath" -ForegroundColor Gray
    Write-Host ""
    
    # Adicionar ao PATH do usuario
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$installDir*") {
        Write-Host "Adicionando ao PATH..." -ForegroundColor Yellow
        $newPath = "$currentPath;$installDir"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Adicionado ao PATH!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Cloudflared instalado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "Reinicie o terminal/PowerShell para usar o comando 'cloudflared'" -ForegroundColor Yellow
    Write-Host "Ou use o caminho completo: $exePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Teste a instalacao:" -ForegroundColor Cyan
    Write-Host "$exePath --version" -ForegroundColor Gray
    
} catch {
    Write-Host ""
    Write-Host "Erro ao instalar Cloudflared:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Download manual:" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Gray
    Write-Host "2. Baixe: cloudflared-windows-amd64.exe" -ForegroundColor Gray
    Write-Host "3. Renomeie para: cloudflared.exe" -ForegroundColor Gray
    Write-Host "4. Coloque em: $installDir" -ForegroundColor Gray
    Write-Host "5. Adicione ao PATH ou use o caminho completo" -ForegroundColor Gray
    exit 1
}
