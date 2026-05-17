require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkData() {
  console.log('Checking psa_sets...')
  const { data: sets, error: setsError } = await supabase
    .from('psa_sets')
    .select('*')
    .limit(5)
  
  if (setsError) {
    console.error('Error:', setsError)
  } else {
    console.log(`Found ${sets.length} sets`)
    if (sets.length > 0) {
      console.log('Sample:', JSON.stringify(sets[0], null, 2))
    }
  }

  console.log('\nChecking psa_cards...')
  const { data: cards, error: cardsError } = await supabase
    .from('psa_cards')
    .select('*')
    .limit(1)
  
  if (cardsError) {
    console.error('Error:', cardsError)
  } else {
    console.log(`Found ${cards.length} cards`)
    if (cards.length > 0) {
      console.log('Sample:', JSON.stringify(cards[0], null, 2))
    }
  }

  console.log('\nChecking sets with card counts...')
  const { data: grouped, error: groupError } = await supabase
    .from('psa_sets')
    .select('psa_spec_id, year, set_name, set_code')
    .order('year', { ascending: false })
    .limit(10)
  
  if (groupError) {
    console.error('Error:', groupError)
  } else {
    console.log('Sets:', JSON.stringify(grouped, null, 2))
  }
}

checkData()
