/**
 * Script para gerar hashes de senha no formato usado pelo sistema
 * Execute: node scripts/gerar-hashes-senha.js
 */

import { randomBytes, pbkdf2Sync } from 'crypto';

function generatePasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

console.log('========================================');
console.log('HASHES DE SENHA PARA TESTE');
console.log('========================================\n');

const senhas = {
  '123456': 'empresa@teste.com',
  'operacional123': 'operacional@teste.com',
  'financeiro123': 'financeiro@teste.com',
};

for (const [senha, email] of Object.entries(senhas)) {
  const hash = generatePasswordHash(senha);
  console.log(`Email: ${email}`);
  console.log(`Senha: ${senha}`);
  console.log(`Hash: ${hash}`);
  console.log('');
}

console.log('========================================');
console.log('Use esses hashes no script SQL');
console.log('========================================');

