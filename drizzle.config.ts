import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

// Garantir que a URL tenha sslmode=require para Supabase
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl.includes('sslmode=')) {
  const separator = databaseUrl.includes('?') ? '&' : '?';
  databaseUrl = `${databaseUrl}${separator}sslmode=require`;
}

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false, // Supabase requer SSL mas aceita certificados auto-assinados
    },
  },
});
