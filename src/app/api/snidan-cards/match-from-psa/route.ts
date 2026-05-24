import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    console.log('[Match from PSA] Starting to match snidan_cards with psa_cards...')

    // RPC またはダイレクト SQL で UPDATE
    const { data, error } = await supabase.rpc('match_snidan_from_psa')

    if (error) {
      // RPC がない場合は、クライアント側で複数回クエリを実行
      console.log('[Match from PSA] RPC not available, using individual updates...')

      // psa_cards から snidan_apparel_id を取得
      const { data: psaCards } = await supabase
        .from('psa_cards')
        .select('snidan_apparel_id, psa_spec_id')
        .not('snidan_apparel_id', 'is', null)

      if (!psaCards || psaCards.length === 0) {
        return Response.json({
          success: true,
          matched: 0,
        })
      }

      let matchedCount = 0

      // snidan_cards を更新
      for (const card of psaCards) {
        const { error: updateError } = await supabase
          .from('snidan_cards')
          .update({ psa_spec_id: card.psa_spec_id })
          .eq('snidan_apparel_id', card.snidan_apparel_id)
          .is('psa_spec_id', null)

        if (!updateError) {
          matchedCount++
        }
      }

      console.log(`[Match from PSA] Matched ${matchedCount} cards`)

      return Response.json({
        success: true,
        matched: matchedCount,
      })
    }

    console.log(`[Match from PSA] Matched ${data?.matched || 0} cards via RPC`)

    return Response.json({
      success: true,
      matched: data?.matched || 0,
    })
  } catch (error) {
    console.error('[Match from PSA] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
