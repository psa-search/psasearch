import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    // snidan_cards から psa_spec_id がある全アイテムを取得
    const { data: cards, error: cardsError } = await supabase
      .from('snidan_cards')
      .select('snidan_apparel_id, psa_spec_id')
      .not('psa_spec_id', 'is', null)

    if (cardsError) {
      throw new Error(cardsError.message)
    }

    if (!cards || cards.length === 0) {
      return Response.json({
        success: true,
        updated: 0,
      })
    }

    console.log(`[Sync to PSA] Syncing ${cards.length} cards to psa_cards...`)

    let updatedCount = 0

    // バッチで update（1000件ずつ）
    const batchSize = 1000
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)

      for (const card of batch) {
        const { error: updateError } = await supabase
          .from('psa_cards')
          .update({ snidan_apparel_id: card.snidan_apparel_id })
          .eq('psa_spec_id', card.psa_spec_id)
          .is('snidan_apparel_id', null) // 既に紐付けされていないものだけ

        if (!updateError) {
          updatedCount++
        }
      }

      console.log(`[Sync to PSA] Progress: ${Math.min(i + batchSize, cards.length)}/${cards.length}`)
    }

    console.log(`[Sync to PSA] Complete: ${updatedCount} cards updated`)

    return Response.json({
      success: true,
      updated: updatedCount,
    })
  } catch (error) {
    console.error('[Sync to PSA] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
