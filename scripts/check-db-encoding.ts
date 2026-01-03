import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });
dotenv.config();

function normalizeUtf8(value: string | null | undefined) {
  return (value || '').replace(/[-_\\s]/g, '').toUpperCase();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Configure it in .env or .env.local.');
    process.exit(1);
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const serverEncoding = (
      await pool.query("select current_setting('server_encoding') as v")
    ).rows[0]?.v as string;
    const clientEncoding = (
      await pool.query("select current_setting('client_encoding') as v")
    ).rows[0]?.v as string;
    const lcCollate = (
      await pool.query("select current_setting('lc_collate') as v")
    ).rows[0]?.v as string;
    const lcCtype = (
      await pool.query("select current_setting('lc_ctype') as v")
    ).rows[0]?.v as string;
    const dbEncoding = (
      await pool.query(
        "select pg_encoding_to_char(encoding) as v from pg_database where datname = current_database()"
      )
    ).rows[0]?.v as string;

    console.log(`server_encoding=${serverEncoding}`);
    console.log(`client_encoding=${clientEncoding}`);
    console.log(`db_encoding=${dbEncoding}`);
    console.log(`lc_collate=${lcCollate}`);
    console.log(`lc_ctype=${lcCtype}`);

    const serverOk = normalizeUtf8(serverEncoding) === 'UTF8';
    const clientOk = normalizeUtf8(clientEncoding) === 'UTF8';
    const dbOk = normalizeUtf8(dbEncoding) === 'UTF8';
    const collateOk = normalizeUtf8(lcCollate).includes('UTF8');
    const ctypeOk = normalizeUtf8(lcCtype).includes('UTF8');

    if (!serverOk || !clientOk || !dbOk) {
      console.error('encoding_check_failed=1');
      process.exit(1);
    }

    if (!collateOk || !ctypeOk) {
      console.warn('encoding_collation_warning=1');
    } else {
      console.log('encoding_check_ok=1');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('encoding_check_error=1');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
