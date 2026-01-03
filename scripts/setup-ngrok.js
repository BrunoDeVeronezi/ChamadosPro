import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ENV_FILE = join(__dirname, '../.env');
const ENV_EXAMPLE = join(__dirname, '../.env.example');

console.log('🔧 Configurando Ngrok...\n');

// Ler .env se existir
let envContent = '';
if (existsSync(ENV_FILE)) {
  envContent = readFileSync(ENV_FILE, 'utf-8');
} else if (existsSync(ENV_EXAMPLE)) {
  envContent = readFileSync(ENV_EXAMPLE, 'utf-8');
  console.log('📄 Criando .env a partir de .env.example...');
}

// Verificar se NGROK_AUTH_TOKEN já existe
if (envContent.includes('NGROK_AUTH_TOKEN=')) {
  console.log('✅ NGROK_AUTH_TOKEN já configurado no .env');
} else {
  console.log('⚠️  NGROK_AUTH_TOKEN não encontrado!');
  console.log('\n📋 Para obter seu token:');
  console.log('   1. Acesse: https://dashboard.ngrok.com/get-started/your-authtoken');
  console.log('   2. Faça login (ou crie uma conta gratuita)');
  console.log('   3. Copie o token');
  console.log('   4. Adicione ao .env: NGROK_AUTH_TOKEN=seu_token_aqui\n');
  
  const token = process.argv[2];
  if (token) {
    if (!envContent.endsWith('\n') && envContent.length > 0) {
      envContent += '\n';
    }
    envContent += `NGROK_AUTH_TOKEN=${token}\n`;
    writeFileSync(ENV_FILE, envContent);
    console.log('✅ Token adicionado ao .env!');
  } else {
    console.log('💡 Ou execute: node scripts/setup-ngrok.js seu_token_aqui\n');
  }
}

// Verificar outras variáveis necessárias
const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SESSION_SECRET',
];

const missing = requiredVars.filter(v => !envContent.includes(`${v}=`));
if (missing.length > 0) {
  console.log('\n⚠️  Variáveis faltando no .env:');
  missing.forEach(v => console.log(`   - ${v}`));
  console.log('\n📝 Configure essas variáveis antes de usar o Ngrok\n');
} else {
  console.log('✅ Todas as variáveis necessárias estão configuradas!\n');
}





































