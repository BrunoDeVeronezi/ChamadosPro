import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

const cloudflaredPath = join(homedir(), '.cloudflared', 'cloudflared.exe');

console.log('Testando cloudflared...');
console.log('Caminho:', cloudflaredPath);
console.log('Existe?', existsSync(cloudflaredPath));

if (existsSync(cloudflaredPath)) {
  console.log('\nExecutando cloudflared --version...\n');
  
  const process = spawn(cloudflaredPath, ['--version'], {
    stdio: 'inherit',
  });
  
  process.on('error', (error) => {
    console.error('Erro:', error);
  });
  
  process.on('close', (code) => {
    console.log(`\nProcesso encerrado com código: ${code}`);
  });
} else {
  console.log('\n❌ Arquivo não encontrado!');
}





































