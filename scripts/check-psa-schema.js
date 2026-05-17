require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkSchema() {
  try {
    const { data, error } = await supabase
      .from('psa_cards')
      .select()
      .limit(1)
    
    if (error) {
      console.error('Error querying table:', error.message)
      return
    }
    
    if (data && data.length > 0) {
      console.log('✓ psa_cards table exists')
      console.log('Columns:', Object.keys(data[0]).join(', '))
    } else {
      console.log('✓ psa_cards table exists but is empty')
      // Try to insert a test row and see what columns are required
      const { error: insertError } = await supabase
        .from('psa_cards')
        .insert([{
          psa_spec_id: 0,
          set_id: 0,
          card_number: 'test',
          card_name: 'test',
          total_graded: 0,
          gem_count_psa10: 0,
          gem_rate_psa10: 0,
        }])
      
      if (insertError) {
        console.log('Insert test failed:', insertError.message)
      }
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

checkSchema()
