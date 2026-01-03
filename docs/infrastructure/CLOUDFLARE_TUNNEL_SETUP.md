# 🌐 Configuração do Cloudflare Tunnel para Debug

O Cloudflare Tunnel (cloudflared) é uma alternativa gratuita ao Ngrok, sem limites de conexões simultâneas e com URLs estáveis.

## 📋 Pré-requisitos

1. Instalar Cloudflared
2. Node.js instalado
3. Variáveis de ambiente configuradas (`.env`)

## 🔧 Instalação do Cloudflared

### Windows

**Opção 1: Via Winget (Recomendado)**
```bash
winget install --id Cloudflare.cloudflared
```

**Opção 2: Download Manual**
1. Acesse: https://github.com/cloudflare/cloudflared/releases
2. Baixe `cloudflared-windows-amd64.exe`
3. Renomeie para `cloudflared.exe`
4. Adicione ao PATH ou coloque na pasta do projeto

**Opção 3: Via Chocolatey**
```bash
choco install cloudflared
```

### Linux/Mac

```bash
# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Mac
brew install cloudflared
```

### Verificar Instalação

```bash
cloudflared --version
```

## 🚀 Uso

### Iniciar com Cloudflare Tunnel (Recomendado)

```bash
npm run dev:tunnel
```

Este comando:
- ✅ Verifica se cloudflared está instalado
- ✅ Inicia o tunnel automaticamente
- ✅ Inicia o servidor na porta 5180
- ✅ Configura automaticamente as URLs de callback
- ✅ Mostra a URL pública gerada

### Iniciar Tunnel Manualmente

Se preferir controlar o tunnel separadamente:

**Terminal 1 - Servidor:**
```bash
npm run dev
```

**Terminal 2 - Tunnel:**
```bash
npm run tunnel
# ou
cloudflared tunnel --url http://localhost:5180
```

## 📝 Configuração do Google OAuth

Após iniciar o tunnel, você receberá uma URL pública como:
```
https://abc123-def456.trycloudflare.com
```

### 1. Atualizar Google Cloud Console

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Selecione seu OAuth 2.0 Client ID
3. Em "Authorized redirect URIs", adicione:
   ```
   https://abc123-def456.trycloudflare.com/api/callback
   ```
4. Em "Authorized JavaScript origins", adicione:
   ```
   https://abc123-def456.trycloudflare.com
   ```
5. Salve as alterações

### 2. Atualizar .env (Opcional)

Se quiser usar a URL do tunnel permanentemente:

```env
GOOGLE_REDIRECT_URI=https://abc123-def456.trycloudflare.com/api/callback
CLOUDFLARE_URL=https://abc123-def456.trycloudflare.com
```

**Nota:** A URL do tunnel muda a cada reinício. Use o script `dev:tunnel` para atualização automática.

## 🔍 Vantagens do Cloudflare Tunnel

✅ **Gratuito** - Sem limites de conexões simultâneas  
✅ **URLs Estáveis** - URLs duram mais tempo que Ngrok  
✅ **Sem Autenticação** - Não precisa de token  
✅ **Rápido** - Performance excelente  
✅ **HTTPS Automático** - SSL/TLS incluído  

## 🆚 Comparação: Cloudflare vs Ngrok

| Recurso | Cloudflare Tunnel | Ngrok |
|---------|------------------|-------|
| Gratuito | ✅ Sim | ✅ Sim (limitado) |
| Conexões simultâneas | ✅ Ilimitadas | ❌ Limitadas |
| URL fixa | ❌ Não (gratuito) | ❌ Não (gratuito) |
| Autenticação | ❌ Não precisa | ✅ Precisa token |
| Performance | ⚡ Excelente | ⚡ Boa |
| Interface Web | ❌ Não | ✅ Sim (localhost:4040) |

## 🛠️ Troubleshooting

### Erro: "cloudflared não encontrado"

**Solução:**
1. Instale o cloudflared (veja seção Instalação)
2. Verifique se está no PATH: `cloudflared --version`
3. Se não estiver no PATH, use o caminho completo

### Erro: "Não foi possível obter a URL"

**Solução:**
1. Verifique se a porta 5180 está livre
2. Verifique se o servidor está rodando
3. Tente reiniciar o tunnel

### URL não aparece

**Solução:**
- Aguarde alguns segundos (pode demorar até 10s)
- Verifique os logs do cloudflared
- Tente reiniciar: `npm run dev:tunnel`

### Tunnel desconecta frequentemente

**Solução:**
- Verifique sua conexão de internet
- Use um tunnel nomeado (requer conta Cloudflare):
  ```bash
  cloudflared tunnel create meu-tunnel
  cloudflared tunnel route dns meu-tunnel meu-dominio.com
  ```

## 📚 Recursos

- [Documentação Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [GitHub Cloudflared](https://github.com/cloudflare/cloudflared)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)

## 🔒 Segurança

⚠️ **Importante:**
- URLs do tunnel são públicas - não exponha dados sensíveis
- Use apenas para desenvolvimento/debug
- Não use em produção sem autenticação adequada
- URLs mudam a cada reinício (gratuito)

## 💡 Dicas

1. **Tunnel Nomeado:** Crie uma conta Cloudflare (gratuita) para tunnels com URLs fixas
2. **Múltiplos Tunnels:** Use portas diferentes para múltiplos ambientes
3. **Webhooks:** Use tunnel para testar webhooks localmente
4. **Mobile Testing:** Acesse sua aplicação local via URL do tunnel no celular

## 🎯 Comandos Rápidos

```bash
# Iniciar servidor + tunnel
npm run dev:tunnel

# Apenas tunnel (se servidor já estiver rodando)
npm run tunnel

# Apenas servidor (sem tunnel)
npm run dev

# Verificar versão do cloudflared
cloudflared --version
```

---

**Status:** ✅ Configurado e pronto para uso!





































