import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const password = 'master@123';
const email = 'master@master.com';
const emailParts = email.split('@');
const uniqueEmail = `${emailParts[0]}+super_admin@${emailParts[1]}`;

// Gerar salt e hash
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto
  .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
  .toString('hex');
const fullHash = `${salt}:${hash}`;

// Gerar UUIDs
const userId = crypto.randomUUID();
const credId = crypto.randomUUID();

let sql = '';
sql += '-- ============================================\n';
sql += '-- Script SQL para criar Master Admin\n';
sql += '-- ============================================\n';
sql += '-- Email para login: master@master.com\n';
sql += '-- Senha: master@123\n';
sql += `-- Email no banco: ${uniqueEmail}\n`;
sql += '-- ============================================\n\n';

sql += '-- 1. Criar usuário Master Admin\n';
sql +=
  'INSERT INTO users (id, email, first_name, last_name, role, created_at, updated_at)\n';
sql += 'VALUES (\n';
sql += `  '${userId}',\n`;
sql += `  '${uniqueEmail}',\n`;
sql += `  'Master',\n`;
sql += `  'Admin',\n`;
sql += `  'super_admin',\n`;
sql += `  NOW(),\n`;
sql += `  NOW()\n`;
sql += ')\n';
sql += 'ON CONFLICT (id) DO UPDATE SET\n';
sql += '  email = EXCLUDED.email,\n';
sql += '  role = EXCLUDED.role,\n';
sql += '  updated_at = NOW();\n\n';

sql += '-- 2. Criar credenciais do Master Admin\n';
sql +=
  'INSERT INTO user_credentials (id, user_id, password_hash, provider, created_at, updated_at)\n';
sql += 'VALUES (\n';
sql += `  '${credId}',\n`;
sql += `  '${userId}',\n`;
sql += `  '${fullHash}',\n`;
sql += `  'email',\n`;
sql += `  NOW(),\n`;
sql += `  NOW()\n`;
sql += ')\n';
sql += 'ON CONFLICT (user_id) DO UPDATE SET\n';
sql += '  password_hash = EXCLUDED.password_hash,\n';
sql += '  updated_at = NOW();\n\n';

sql += '-- ============================================\n';
sql += '-- Fim do script\n';
sql += '-- ============================================\n';

// Escrever no arquivo
const outputPath = path.join(__dirname, '..', 'master-admin.sql');
fs.writeFileSync(outputPath, sql, 'utf8');

console.log('✅ Arquivo SQL criado com sucesso!');
console.log(`📁 Localização: ${outputPath}`);
console.log('\n📋 Conteúdo do SQL:\n');
console.log(sql);



















