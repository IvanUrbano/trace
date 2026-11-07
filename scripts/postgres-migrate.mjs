import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.TRACE_DATABASE_URL) {
  console.error('Set TRACE_DATABASE_URL for the dedicated TRACE database before running migrations.')
  process.exit(1)
}
const pool = new pg.Pool({ connectionString: process.env.TRACE_DATABASE_URL, max: 1 })
let client
try {
  client = await pool.connect()
  await client.query("SELECT pg_advisory_lock(hashtext('trace.schema_migrations'))")
  const exists = await client.query("SELECT to_regclass('trace.schema_migrations') AS name")
  if (exists.rows[0].name) {
    const current = await client.query('SELECT version FROM trace.schema_migrations WHERE version=1')
    if (!current.rowCount) throw new Error('Existing TRACE schema has no recognized migration version; inspect it manually.')
    console.log('TRACE PostgreSQL migration 1 is already applied.')
  } else {
    const sql = await readFile(new URL('../backend/postgres/001_initial.sql', import.meta.url), 'utf8')
    await client.query(sql)
    console.log('Applied TRACE PostgreSQL migration 1.')
  }
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {})
  console.error(`Migration failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (client) {
    await client.query("SELECT pg_advisory_unlock(hashtext('trace.schema_migrations'))").catch(() => {})
    client.release()
  }
  await pool.end()
}
