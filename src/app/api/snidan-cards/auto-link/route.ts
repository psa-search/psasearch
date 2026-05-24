import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    // snidan_cards から紐付けされていないアイテムを取得
    const { data: cards, error: cardsError } = await supabase
      .from('snidan_cards')
      .select('snidan_apparel_id, snidan_code')
      .is('psa_spec_id', null)

    if (cardsError) {
      throw new Error(cardsError.message)
    }

    if (!cards || cards.length === 0) {
      return Response.json({
        success: true,
        linked: 0,
        multipleMatches: 0,
        notFound: 0,
      })
    }

    console.log(`[Snidan Auto Link] Processing ${cards.length} unlinked cards...`)

    let linkedCount = 0
    let multipleMatchCount = 0
    let notFoundCount = 0

    for (const card of cards) {
      if (!card.snidan_code) {
        notFoundCount++
        continue
      }

      // snidan_code をパース: "M1S 090/063" → setCode: "M1S", cardNumber: "090"
      // "#" を削除（例：DP4 #181 → DP4 181）
      const normalizedCode = card.snidan_code.replace(/#\s*/, '')
      const codeMatch = normalizedCode.match(/^([A-Za-z0-9\-+]+)\s+(\d+)/)
      if (!codeMatch) {
        notFoundCount++
        continue
      }

      const setCode = codeMatch[1]
      const cardNumber = codeMatch[2]

      // psa_sets からセット ID を取得（大文字小文字区別しない）
      const { data: sets } = await supabase
        .from('psa_sets')
        .select('psa_spec_id')
        .ilike('set_code', setCode)

      if (!sets || sets.length === 0) {
        notFoundCount++
        continue
      }

      const setId = sets[0].psa_spec_id

      // psa_cards から該当するカードを検索
      const { data: psaCards } = await supabase
        .from('psa_cards')
        .select('psa_spec_id')
        .eq('set_id', setId)
        .ilike('card_number', `${cardNumber}%`)
        .eq('is_valid', true)

      if (!psaCards || psaCards.length === 0) {
        notFoundCount++
        continue
      }

      if (psaCards.length > 1) {
        // 複数件の場合はスキップ（バリエーション違い）
        multipleMatchCount++
        continue
      }

      // 1件だけ見つかった場合は紐付け（両テーブルを更新）
      const specId = psaCards[0].psa_spec_id

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
      }
    }

    console.log(`[Snidan Auto Link] Complete: ${linkedCount} linked, ${multipleMatchCount} multiple, ${notFoundCount} not found`)

    return Response.json({
      success: true,
      linked: linkedCount,
      multipleMatches: multipleMatchCount,
      notFound: notFoundCount,
    })
  } catch (error) {
    console.error('[Snidan Auto Link] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
