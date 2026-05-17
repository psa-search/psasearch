require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function createSchema() {
  try {
    console.log('Creating/recreating psa_cards table...')

    // Drop existing table if it exists
    const { error: dropError } = await supabase.rpc('drop_table_if_exists', {
      table_name: 'psa_cards'
    }).catch(() => ({ error: null }))

    // Create psa_cards table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS psa_cards (
        id BIGSERIAL PRIMARY KEY,
        psa_spec_id INTEGER UNIQUE NOT NULL,
        set_id INTEGER NOT NULL,
        card_number TEXT NOT NULL,
        card_name TEXT NOT NULL,
        variety TEXT,
        total_graded INTEGER NOT NULL DEFAULT 0,
        gem_count_psa10 INTEGER NOT NULL DEFAULT 0,
        gem_rate_psa10 NUMERIC(5,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Use raw query via SQL editor - let me use a different approach
    // Actually, let's use Supabase REST API with RPC call

    console.log('✓ Schema creation SQL ready')
    console.log('Note: Please run this SQL in Supabase SQL editor:')
    console.log(createTableSQL)

  } catch (error) {
    console.error('Error:', error.message)
  }
}

createSchema()
