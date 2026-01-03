import { spawn } from 'child_process';
import ngrok from 'ngrok';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 5180;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;

let ngrokUrl = null;
let serverProcess = null;
let ngrokProcess = null;

async function startNgrok() {
  try {
    console.log('🚀 Iniciando Ngrok...');
    
    const config = {
      addr: PORT,
      authtoken: NGROK_AUTH_TOKEN,
    };

    const url = await ngrok.connect(config);
    ngrokUrl = url;
    
    console.log('\n✅ Ngrok conectado!');
    console.log(`🌐 URL pública: ${url}`);
    console.log(`📋 Use esta URL para configurar os callbacks do Google OAuth\n`);
    
    // Atualizar variáveis de ambiente
    process.env.NGROK_URL = url;
    process.env.GOOGLE_REDIRECT_URI = `${url}/api/callback`;
    
    // Salvar URL em arquivo para uso posterior
    const fs = await import('fs');
    const ngrokInfo = {
      url,
      port: PORT,
      startedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      join(__dirname, '../.ngrok.json'),
      JSON.stringify(ngrokInfo, null, 2)
    );
    
    return url;
  } catch (error) {
    console.error('❌ Erro ao iniciar Ngrok:', error.message);
    if (!NGROK_AUTH_TOKEN) {
      console.error('\n⚠️  NGROK_AUTH_TOKEN não configurado!');
      console.error('   Obtenha seu token em: https://dashboard.ngrok.com/get-started/your-authtoken');
      console.error('   Adicione ao .env: NGROK_AUTH_TOKEN=seu_token_aqui\n');
    }
    process.exit(1);
  }
}

function startServer() {
  console.log('🖥️  Iniciando servidor...\n');
  
  serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NGROK_URL: ngrokUrl,
      GOOGLE_REDIRECT_URI: ngrokUrl ? `${ngrokUrl}/api/callback` : undefined,
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
  
  if (ngrokUrl) {
    try {
      await ngrok.disconnect();
      await ngrok.kill();
      console.log('✅ Ngrok desconectado');
    } catch (error) {
      console.error('⚠️  Erro ao desconectar Ngrok:', error.message);
    }
  }
  
  if (serverProcess) {
    serverProcess.kill();
  }
  
  process.exit(0);
}

// Tratamento de sinais para cleanup
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado:', error);
  cleanup();
});

// Iniciar
(async () => {
  try {
    const url = await startNgrok();
    startServer();
    
    console.log('\n📝 URLs configuradas:');
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`   Público: ${url}`);
    console.log(`   Callback: ${url}/api/callback\n`);
    console.log('💡 Dica: Configure esta URL no Google Cloud Console:');
    console.log(`   ${url}/api/callback\n`);
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    cleanup();
  }
})();





































