import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Script de teste para verificar se o Cloudflare Tunnel consegue conectar
 */
const cloudflaredPath = join(homedir(), '.cloudflared', 'cloudflared.exe');

console.log('🧪 Testando conexão do Cloudflare Tunnel...\n');
console.log(`📁 Caminho: ${cloudflaredPath}\n`);

const testProcess = spawn(
  cloudflaredPath,
  ['tunnel', '--url', 'http://localhost:5180'],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let output = '';
let hasUrl = false;

// A URL vem no stderr, não no stdout!
testProcess.stderr?.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);

  // Procurar URL - apenas trycloudflare.com
  const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g;
  const matches = text.match(urlPattern);

  if (matches && matches.length > 0 && !hasUrl) {
    hasUrl = true;
    const url = matches[0];
    console.log('\n\n✅ SUCESSO! URL obtida:', url);
    console.log('\n📋 Use esta URL para configurar no Google Cloud Console:');
    console.log(`   ${url}/api/callback\n`);
    console.log('⏹️  Pressione Ctrl+C para encerrar o teste\n');
  }

  if (text.includes('timeout') || text.includes('i/o timeout')) {
    console.error('\n⚠️  Erro de timeout detectado!');
    console.error('   Isso geralmente indica problema de rede/firewall\n');
  }
});

testProcess.stdout?.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
});

testProcess.on('exit', (code) => {
  if (code === 0 || hasUrl) {
    console.log('\n✅ Teste concluído com sucesso!');
  } else {
    console.error(`\n❌ Teste falhou com código ${code}`);
    console.error('\n💡 Verifique:');
    console.error('   1. Conexão com internet');
    console.error('   2. Firewall/antivírus');
    console.error('   3. Proxy/VPN ativo');
    console.error('   4. Servidor local rodando em http://localhost:5180\n');
  }
  process.exit(code || 0);
});

// Timeout de 45 segundos
setTimeout(() => {
  if (!hasUrl) {
    console.error('\n⏱️  Timeout: Não foi possível obter URL em 45 segundos');
    console.error('   Encerrando teste...\n');
    testProcess.kill();
    process.exit(1);
  }
}, 45000);
