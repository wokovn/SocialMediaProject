import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

// Connect to localhost:54322 as database host
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

console.log('Connecting to database:', connectionString)

const sql = postgres(connectionString, { prepare: false })

async function run() {
  try {
    console.log('Applying banner, show_email, website columns to users table...')
    await sql`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banner TEXT;`
    await sql`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT FALSE;`
    await sql`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS website TEXT;`

    console.log('Creating full-text search indexes...')
    await sql`CREATE INDEX IF NOT EXISTS users_fts_idx ON public.users USING GIN (to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(username, '')));`
    await sql`CREATE INDEX IF NOT EXISTS posts_fts_idx ON public.posts USING GIN (to_tsvector('simple', coalesce(content, '')));`

    console.log('Database migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await sql.end()
  }
}

run()
