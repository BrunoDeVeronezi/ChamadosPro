import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 5180;
let tunnelUrl = null;
let serverProcess = null;
let cloudflareProcess = null;

function getCloudflaredPath() {
  // Caminho padrão de instalação no Windows
  const defaultPath = join(homedir(), '.cloudflared', 'cloudflared.exe');

  // Verificar se existe no caminho padrão
  if (existsSync(defaultPath)) {
    console.log(`✅ Cloudflared encontrado em: ${defaultPath}`);
    return defaultPath;
  }

  console.log(`⚠️  Cloudflared não encontrado em: ${defaultPath}`);
  console.log(`   Tentando usar 'cloudflared' do PATH...`);

  // Tentar usar 'cloudflared' do PATH
  return 'cloudflared';
}

function startCloudflareTunnel() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando Cloudflare Tunnel...\n');

    const cloudflaredPath = getCloudflaredPath();
    const isAbsolutePath =
      cloudflaredPath.includes('\\') || cloudflaredPath.includes('/');

    // Verificar se o arquivo existe (se for caminho absoluto)
    if (isAbsolutePath && !existsSync(cloudflaredPath)) {
      console.error('❌ Cloudflared não encontrado em:', cloudflaredPath);
      console.error('\n📥 Para instalar automaticamente:');
      console.error('   npm run install:cloudflared');
      console.error('   ou execute: scripts\\install-cloudflared.bat');
      console.error('\n📥 Ou baixe manualmente:');
      console.error('   https://github.com/cloudflare/cloudflared/releases');
      console.error('   Baixe: cloudflared-windows-amd64.exe');
      console.error('   Renomeie para: cloudflared.exe');
      console.error('   Coloque em: %USERPROFILE%\\.cloudflared\n');
      reject(new Error('Cloudflared não encontrado'));
      return;
    }

    // Verificar se o servidor local está rodando
    console.log(
      `🔍 Verificando se o servidor está rodando em http://localhost:${PORT}...`
    );
    console.log('   (Se não estiver, o tunnel pode falhar)\n');

    // Iniciar tunnel diretamente
    console.log('🌐 Criando tunnel público...');
    console.log(
      `   Comando: ${cloudflaredPath} tunnel --url http://localhost:${PORT}\n`
    );

    const tunnelSpawnOptions = isAbsolutePath
      ? { stdio: ['ignore', 'pipe', 'pipe'] } // Sem shell para caminho absoluto
      : { stdio: ['ignore', 'pipe', 'pipe'], shell: true }; // Com shell para comando do PATH

    cloudflareProcess = spawn(
      cloudflaredPath,
      ['tunnel', '--url', `http://localhost:${PORT}`],
      tunnelSpawnOptions
    );

    let output = '';
    let errorOutput = '';
    let hasShownConnecting = false;
    let connectionTimeout = null;

    cloudflareProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Mostrar output do cloudflared
      process.stdout.write(text);

      // Detectar mensagens de conexão
      if (text.includes('Connecting') || text.includes('connecting')) {
        if (!hasShownConnecting) {
          console.log('\n⏳ Aguardando conexão com Cloudflare...');
          hasShownConnecting = true;
        }
      }

      // Extrair URL do output (apenas trycloudflare.com, não www.cloudflare.com)
      const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g;

      const matches = text.match(urlPattern);
      if (matches && matches.length > 0) {
        // Pegar a primeira URL encontrada
        const url = matches[0];
        if (!tunnelUrl && url.includes('trycloudflare.com')) {
          tunnelUrl = url;
          console.log('\n✅ Cloudflare Tunnel conectado!');
          console.log(`🌐 URL pública: ${tunnelUrl}`);
          console.log(
            `📋 Use esta URL para configurar os callbacks do Google OAuth\n`
          );

          // Atualizar variáveis de ambiente
          process.env.CLOUDFLARE_URL = tunnelUrl;
          process.env.NGROK_URL = tunnelUrl; // Compatibilidade com código existente
          process.env.GOOGLE_REDIRECT_URI = `${tunnelUrl}/api/callback`;

          // Salvar URL em arquivo
          const tunnelInfo = {
            url: tunnelUrl,
            port: PORT,
            startedAt: new Date().toISOString(),
            provider: 'cloudflare',
          };
          writeFileSync(
            join(__dirname, '../.tunnel.json'),
            JSON.stringify(tunnelInfo, null, 2)
          );

          // Limpar timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }

          resolve(tunnelUrl);
          return;
        }
      }
    });

    cloudflareProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;

      // Mostrar todos os erros para debug
      process.stderr.write(`[cloudflared stderr] ${text}`);

      // IMPORTANTE: A URL do Cloudflare vem no stderr, não no stdout!
      // Procurar URL no stderr também - APENAS trycloudflare.com (não www.cloudflare.com)
      const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g;

      const matches = text.match(urlPattern);
      if (matches && matches.length > 0) {
        // Pegar a primeira URL encontrada (deve ser a do tunnel)
        const url = matches[0];
        if (!tunnelUrl && url.includes('trycloudflare.com')) {
          tunnelUrl = url;
          console.log('\n✅ Cloudflare Tunnel conectado!');
          console.log(`🌐 URL pública: ${tunnelUrl}`);
          console.log(
            `📋 Use esta URL para configurar os callbacks do Google OAuth\n`
          );

          // Atualizar variáveis de ambiente
          process.env.CLOUDFLARE_URL = tunnelUrl;
          process.env.NGROK_URL = tunnelUrl; // Compatibilidade com código existente
          process.env.GOOGLE_REDIRECT_URI = `${tunnelUrl}/api/callback`;

          // Salvar URL em arquivo
          const tunnelInfo = {
            url: tunnelUrl,
            port: PORT,
            startedAt: new Date().toISOString(),
            provider: 'cloudflare',
          };
          writeFileSync(
            join(__dirname, '../.tunnel.json'),
            JSON.stringify(tunnelInfo, null, 2)
          );

          // Limpar timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }

          resolve(tunnelUrl);
          return;
        }
      }

      // Detectar erros de rede (mas não bloquear se já temos URL)
      if (
        (text.includes('timeout') ||
          text.includes('i/o timeout') ||
          text.includes('network')) &&
        !tunnelUrl
      ) {
        console.error('\n⚠️  Erro de rede detectado!');
        console.error('   Possíveis causas:');
        console.error('   - Firewall bloqueando conexões');
        console.error('   - Proxy/VPN interferindo');
        console.error('   - Problema temporário com servidores Cloudflare');
        console.error('   - Servidor local não está rodando\n');
      }
    });

    cloudflareProcess.on('error', (error) => {
      console.error('\n❌ Erro ao iniciar Cloudflare Tunnel:', error.message);
      console.error('   Caminho tentado:', cloudflaredPath);
      console.error('\n📥 Para instalar automaticamente:');
      console.error('   npm run install:cloudflared');
      console.error('   ou execute: scripts\\install-cloudflared.bat\n');
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      reject(error);
    });

    cloudflareProcess.on('exit', (code) => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }

      if (code !== 0 && code !== null) {
        console.error(`\n❌ Cloudflare Tunnel encerrado com código ${code}`);
        if (errorOutput) {
          console.error('\n📋 Últimas mensagens de erro:');
          const errorLines = errorOutput
            .split('\n')
            .filter(
              (line) =>
                line.includes('error') ||
                line.includes('Error') ||
                line.includes('failed') ||
                line.includes('timeout')
            );
          if (errorLines.length > 0) {
            errorLines.slice(-5).forEach((line) => console.error(`   ${line}`));
          } else {
            console.error(
              '   (Nenhuma mensagem de erro específica encontrada)'
            );
          }
        }
        if (!tunnelUrl) {
          console.error('\n💡 Dicas para resolver:');
          console.error('   1. Verifique sua conexão com a internet');
          console.error(
            '   2. Tente desabilitar temporariamente firewall/antivírus'
          );
          console.error('   3. Verifique se há proxy/VPN ativo');
          console.error('   4. Tente executar manualmente:');
          console.error(
            `      ${cloudflaredPath} tunnel --url http://localhost:${PORT}`
          );
          console.error('   5. Aguarde alguns minutos e tente novamente\n');
          reject(new Error(`Tunnel falhou com código ${code}`));
        }
      }
    });

    // Timeout aumentado para 30 segundos (conexões podem demorar)
    connectionTimeout = setTimeout(() => {
      if (!tunnelUrl) {
        console.error(
          '\n⚠️  Timeout: Não foi possível obter a URL do tunnel em 30 segundos'
        );
        console.error('   Isso pode indicar:');
        console.error('   - Problema de rede/conectividade');
        console.error('   - Firewall bloqueando conexões');
        console.error('   - Servidor local não está rodando');
        console.error('\n💡 Tente:');
        console.error(
          `   1. Verificar se o servidor está rodando: http://localhost:${PORT}`
        );
        console.error('   2. Executar manualmente para ver mais detalhes:');
        console.error(
          `      ${cloudflaredPath} tunnel --url http://localhost:${PORT}`
        );
        console.error('   3. Verificar logs acima para mais informações\n');

        // Não rejeitar ainda, pode conectar depois
        // Apenas avisar o usuário
      }
    }, 30000);
  });
}

function startServer() {
  console.log('🖥️  Iniciando servidor...\n');

  serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CLOUDFLARE_URL: tunnelUrl,
      NGROK_URL: tunnelUrl,
      GOOGLE_REDIRECT_URI: tunnelUrl ? `${tunnelUrl}/api/callback` : undefined,
    },
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Erro ao iniciar servidor:', error);
    cleanup();
  });

  serverProcess.on('exit', (code) => {
    console.log(`\n🛑 Servidor encerrado com código ${code}`);
    cleanup();
  });
}

async function cleanup() {
  console.log('\n🧹 Limpando...');

  if (cloudflareProcess) {
    cloudflareProcess.kill();
    console.log('✅ Cloudflare Tunnel desconectado');
  }

  if (serverProcess) {
    serverProcess.kill();
  }

  process.exit(0);
}

// Tratamento de sinais
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado:', error);
  cleanup();
});

// Iniciar
(async () => {
  try {
    await startCloudflareTunnel();
    startServer();

    if (tunnelUrl) {
      console.log('\n📝 URLs configuradas:');
      console.log(`   Local: http://localhost:${PORT}`);
      console.log(`   Público: ${tunnelUrl}`);
      console.log(`   Callback: ${tunnelUrl}/api/callback\n`);
      console.log('💡 Dica: Configure esta URL no Google Cloud Console:');
      console.log(`   ${tunnelUrl}/api/callback\n`);
    }
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    cleanup();
  }
})();
