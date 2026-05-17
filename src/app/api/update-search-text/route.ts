import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    // Get all cards with set info
    const { data: allCards, error: cardsError } = await supabase
      .from('psa_cards')
      .select('psa_spec_id, set_id, card_number, card_name, card_name_ja')
      .limit(100000)

    if (cardsError || !allCards) {
      return Response.json({ error: cardsError?.message || 'Failed to fetch cards' }, { status: 500 })
    }

    // Get all sets
    const { data: allSets } = await supabase
      .from('psa_sets')
      .select('psa_spec_id, set_code, set_name')

    const setMap = new Map(allSets?.map((s: any) => [s.psa_spec_id, { set_code: s.set_code, set_name: s.set_name }]) || [])

    // Build search text and update in batches
    const batchSize = 100
    let updated = 0

    for (let i = 0; i < allCards.length; i += batchSize) {
      const batch = allCards.slice(i, i + batchSize)

      const updatePromises = batch.map((card: any) => {
        const setInfo = setMap.get(card.set_id)
        const searchParts = [
          setInfo?.set_code || '',
          setInfo?.set_name || '',
          card.card_number || '',
          card.card_name || '',
          card.card_name_ja || ''
        ]
        const searchText = searchParts.filter(p => p).join(' ')

        return supabase
          .from('psa_cards')
          .update({ search_text: searchText })
          .eq('psa_spec_id', card.psa_spec_id)
      })

      const results = await Promise.all(updatePromises)
      const successCount = results.filter(r => !r.error).length
      updated += successCount
    }

    return Response.json({
      success: true,
      total: allCards.length,
      updated
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
