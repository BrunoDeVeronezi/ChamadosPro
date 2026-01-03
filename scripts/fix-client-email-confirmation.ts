import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local', override: true });
dotenv.config();

const { Pool } = pg;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Configure it in .env or .env.local.');
    process.exit(1);
  }
  try {
    const parsed = new URL(databaseUrl);
    if (!parsed.protocol || !parsed.hostname) {
      throw new Error('DATABASE_URL is missing protocol or hostname.');
    }
  } catch (error) {
    console.error('DATABASE_URL is invalid. Expected a postgres connection URL.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  const statements = [
    `ALTER TABLE clients
     ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT false`,
    `ALTER TABLE clients
     ADD COLUMN IF NOT EXISTS email_confirmation_token TEXT`,
    `ALTER TABLE clients
     ADD COLUMN IF NOT EXISTS email_confirmation_expires_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_clients_email_confirmation_expires
     ON clients(email_confirmation_expires_at)
     WHERE email_confirmed = false AND email_confirmation_expires_at IS NOT NULL`,
    `COMMENT ON COLUMN clients.email_confirmation_expires_at IS
     'Email confirmation expiration timestamp (clients).'`,
  ];

  try {
    for (const sql of statements) {
      await pool.query(sql);
    }
    console.log('client_email_confirmation_fix_ok=1');
  } catch (error) {
    console.error('client_email_confirmation_fix_failed=1');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('client_email_confirmation_fix_failed=1');
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
