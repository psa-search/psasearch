import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    console.log('[Masterball Link] Starting masterball auto-linking...')

    // マスターボールが含まれている未リンクカードを取得
    const { data: cards, error: cardsError } = await supabase
      .from('snidan_cards')
      .select('snidan_apparel_id, snidan_code')
      .ilike('snidan_name_ja', '%マスターボール%')
      .is('psa_spec_id', null)

    if (cardsError) {
      throw new Error(cardsError.message)
    }

    if (!cards || cards.length === 0) {
      console.log('[Masterball Link] No masterball cards found')
      return Response.json({
        success: true,
        processed: 0,
        linked: 0
      })
    }

    console.log(`[Masterball Link] Found ${cards.length} masterball cards to process`)

    let linkedCount = 0
    let skippedCount = 0

    for (const card of cards) {
      if (!card.snidan_code) {
        console.log(`[Masterball Link] Skipped ${card.snidan_apparel_id}: no snidan_code`)
        skippedCount++
        continue
      }

      // snidanコードから setCode と cardNumber を抽出
      const codeMatch = card.snidan_code.match(/^([A-Za-z0-9\-+]+)\s+(\d+)/)
      if (!codeMatch) {
        console.log(`[Masterball Link] Skipped ${card.snidan_apparel_id}: code parse failed (${card.snidan_code})`)
        skippedCount++
        continue
      }

      const setCode = codeMatch[1]
      const cardNumber = codeMatch[2]

      // セットを検索
      const { data: sets } = await supabase
        .from('psa_sets')
        .select('psa_spec_id')
        .ilike('set_code', setCode)

      if (!sets || sets.length === 0) {
        console.log(`[Masterball Link] Skipped ${card.snidan_apparel_id}: set not found (${setCode})`)
        skippedCount++
        continue
      }

      const setId = sets[0].psa_spec_id

      // 候補を検索（マスターボール条件）
      const { data: candidates } = await supabase
        .from('psa_cards')
        .select('psa_spec_id, card_name, variety, card_number')
        .eq('set_id', setId)
        .eq('card_number', cardNumber)
        .eq('is_valid', true)
        .ilike('variety', '%Master Ball%')

      if (!candidates || candidates.length !== 1) {
        // 候補が0件か2件以上の場合はスキップ
        console.log(`[Masterball Link] Skipped ${card.snidan_apparel_id}: ${candidates?.length || 0} candidates found`)
        skippedCount++
        continue
      }

      // 1件だけ見つかった場合は紐づけ
      const specId = candidates[0].psa_spec_id

      // snidan_cards を更新
      const { error: snidanError } = await supabase
        .from('snidan_cards')
        .update({ psa_spec_id: specId })
        .eq('snidan_apparel_id', card.snidan_apparel_id)

      // psa_cards も更新
      const { error: psaError } = await supabase
        .from('psa_cards')
        .update({ snidan_apparel_id: card.snidan_apparel_id })
        .eq('psa_spec_id', specId)

      if (!snidanError && !psaError) {
        linkedCount++
        console.log(`[Masterball Link] Linked ${card.snidan_apparel_id}`)
      }
    }

    console.log(`[Masterball Link] Complete: ${linkedCount} linked, ${skippedCount} skipped`)

    return Response.json({
      success: true,
      processed: cards.length,
      linked: linkedCount,
      skipped: skippedCount
    })
  } catch (error) {
    console.error('[Masterball Link] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
