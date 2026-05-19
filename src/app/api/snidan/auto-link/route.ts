import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { snidanId, snidanCode } = await request.json()

    if (!snidanCode) {
      return Response.json(
        { success: false, reason: 'snidanCode is required' },
        { status: 400 }
      )
    }

    // snidanCode をパース: "M1S 090/063" → setCode: "M1S", cardNumber: "090"
    const codeMatch = snidanCode.match(/^([A-Za-z0-9]+)\s+(\d+)/)
    if (!codeMatch) {
      return Response.json(
        { success: false, reason: 'Invalid snidanCode format' },
        { status: 400 }
      )
    }

    const setCode = codeMatch[1]
    const cardNumber = codeMatch[2]

    console.log(`[Auto Link] Searching for setCode="${setCode}" cardNumber="${cardNumber}"`)

    // psa_sets からセット ID を取得（大文字小文字区別しない）
    const { data: sets, error: setError } = await supabase
      .from('psa_sets')
      .select('psa_spec_id')
      .ilike('set_code', setCode)

    if (setError || !sets || sets.length === 0) {
      console.log(`[Auto Link] Set not found for "${setCode}"`)
      return Response.json({
        success: false,
        reason: 'Set code not found',
      })
    }

    const setId = sets[0].psa_spec_id

    // psa_cards から該当するカードを検索（大文字小文字区別しない）
    const { data: cards, error: cardError } = await supabase
      .from('psa_cards')
      .select(
        `psa_spec_id, card_name, card_number, snidan_apparel_id,
         psa_psa10_avg_price_3d, psa_psa10_qty_3d,
         psa_psa9_avg_price_3d, psa_psa9_qty_3d,
         snidan_psa10_avg_price_3d, snidan_psa10_qty_3d,
         snidan_psa9_avg_price_3d, snidan_psa9_qty_3d,
         snidan_a_avg_price_3d, snidan_a_qty_3d`
      )
      .eq('set_id', setId)
      .ilike('card_number', `${cardNumber}%`)
      .eq('is_valid', true)

    if (cardError) {
      console.error('[Auto Link] Card search error:', cardError)
      return Response.json(
        { success: false, reason: 'Database error' },
        { status: 500 }
      )
    }

    if (!cards || cards.length === 0) {
      console.log(`[Auto Link] Card not found for ${setCode} ${cardNumber}`)
      return Response.json({
        success: false,
        reason: 'Card not found',
      })
    }

    if (cards.length > 1) {
      console.log(`[Auto Link] Multiple cards found (${cards.length}) - skipping auto-link`)
      return Response.json({
        success: false,
        reason: 'Multiple variations found - manual linking required',
      })
    }

    const card = cards[0]
    const specId = card.psa_spec_id

    // snidan_apparel_id を更新
    const { error: updateError } = await supabase
      .from('psa_cards')
      .update({ snidan_apparel_id: snidanId })
      .eq('psa_spec_id', specId)

    if (updateError) {
      console.error('[Auto Link] Update error:', updateError)
      return Response.json(
        { success: false, reason: 'Failed to update card' },
        { status: 500 }
      )
    }

    console.log(`[Auto Link] Linked specId=${specId} to snidanId=${snidanId}`)

    // 価格データを取得
    const priceResponse = await fetch('http://localhost:3000/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specIds: [specId] }),
    })

    if (priceResponse.ok) {
      const priceData = await priceResponse.json()
      if (priceData.results && priceData.results.length > 0) {
        const result = priceData.results[0]

        // 価格データを psa_cards に保存
        await supabase
          .from('psa_cards')
          .update({
            psa_psa10_avg_price_3d: result.psa_psa10_avg_price_3d,
            psa_psa10_qty_3d: result.psa_psa10_qty_3d,
            psa_psa9_avg_price_3d: result.psa_psa9_avg_price_3d,
            psa_psa9_qty_3d: result.psa_psa9_qty_3d,
            snidan_psa10_avg_price_3d: result.snidan_psa10_avg_price_3d,
            snidan_psa10_qty_3d: result.snidan_psa10_qty_3d,
            snidan_psa9_avg_price_3d: result.snidan_psa9_avg_price_3d,
            snidan_psa9_qty_3d: result.snidan_psa9_qty_3d,
            snidan_a_avg_price_3d: result.snidan_a_avg_price_3d,
            snidan_a_qty_3d: result.snidan_a_qty_3d,
          })
          .eq('psa_spec_id', specId)

        console.log(`[Auto Link] Price data updated for specId=${specId}`)
      }
    }

    return Response.json({
      success: true,
      specId,
      card: {
        psa_spec_id: card.psa_spec_id,
        card_name: card.card_name,
        card_number: card.card_number,
      },
    })
  } catch (error) {
    console.error('[Auto Link] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
