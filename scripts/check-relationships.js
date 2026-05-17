require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
  // psa_cards に set_id が存在するか、それが psa_sets の何と対応しているか確認
  const { data: cardWithSet } = await supabase
    .from('psa_cards')
    .select('set_id, psa_spec_id')
    .limit(1)

  console.log('Card set_id:', cardWithSet?.[0]?.set_id)

  // その set_id が psa_sets に存在するか？
  if (cardWithSet?.[0]?.set_id) {
    const { data: matchingSet } = await supabase
      .from('psa_sets')
      .select('*')
      .eq('psa_spec_id', cardWithSet[0].set_id)
    
    console.log('Matching set:', matchingSet)
  }

  // psa_sets と psa_cards の関連を集計
  console.log('\n集計:')
  const { data: stats } = await supabase
    .rpc('check_card_set_mapping')
    .catch(() => null)
  
  if (!stats) {
    console.log('RPC not available, checking manually...')
    
    // 全セットとそのカード数を数える
    const { data: allSets } = await supabase
      .from('psa_sets')
      .select('psa_spec_id, set_name')
    
    const { data: allCards } = await supabase
      .from('psa_cards')
      .select('set_id')
    
    const setCardCounts = new Map()
    for (const card of allCards || []) {
      const count = setCardCounts.get(card.set_id) || 0
      setCardCounts.set(card.set_id, count + 1)
    }
    
    console.log('\nSet card counts (top 5):')
    for (const set of (allSets || []).slice(0, 5)) {
      const count = setCardCounts.get(set.psa_spec_id) || 0
      console.log(`${set.set_name} (${set.psa_spec_id}): ${count} cards`)
    }
  }
}

check()
