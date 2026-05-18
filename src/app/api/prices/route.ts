import { fetchAndSaveCardPrices } from '@/app/actions/psa'

export async function POST(request: Request) {
  try {
    const { specIds } = await request.json()
    console.log('[API] /api/prices called with specIds:', specIds)

    if (!Array.isArray(specIds) || specIds.length === 0) {
      return Response.json(
        { error: 'specIds must be a non-empty array' },
        { status: 400 }
      )
    }

    const results = []
    let successCount = 0

    for (const specId of specIds) {
      console.log(`[API] Fetching prices for specId: ${specId}`)
      const success = await fetchAndSaveCardPrices(specId)
      console.log(`[API] fetchAndSaveCardPrices result: success=${success}`)
      if (success) {
        successCount++
        // Fetch updated card data
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: card } = await supabase
          .from('psa_cards')
          .select('psa_psa10_avg_price_3d, psa_psa10_qty_3d, psa_psa9_avg_price_3d, psa_psa9_qty_3d, snidan_apparel_id, snidan_psa10_avg_price_3d, snidan_psa9_avg_price_3d, snidan_psa10_qty_3d, snidan_psa9_qty_3d, snidan_a_avg_price_3d, snidan_a_qty_3d, snidan_code')
          .eq('psa_spec_id', specId)
          .single()

        // Convert USD to JPY for display
        const { getDollarRate } = await import('@/lib/exchange-rate')
        const rate = await getDollarRate()
        console.log(`[API] Exchange rate USD/JPY: ${rate}`)
        console.log(`[API] Card prices (USD): psa10=${card?.psa_psa10_avg_price_3d}, psa9=${card?.psa_psa9_avg_price_3d}`)

        const psa10Jpy = card?.psa_psa10_avg_price_3d ? Math.round(card.psa_psa10_avg_price_3d * rate) : null
        const psa9Jpy = card?.psa_psa9_avg_price_3d ? Math.round(card.psa_psa9_avg_price_3d * rate) : null

        console.log(`[API] Card prices (JPY): psa10=${psa10Jpy}, psa9=${psa9Jpy}`)

        results.push({
          specId,
          success,
          psa_psa10_avg_price_3d: psa10Jpy,
          psa_psa10_qty_3d: card?.psa_psa10_qty_3d || 0,
          psa_psa9_avg_price_3d: psa9Jpy,
          psa_psa9_qty_3d: card?.psa_psa9_qty_3d || 0,
          snidan_apparel_id: card?.snidan_apparel_id,
          snidan_psa10_avg_price_3d: card?.snidan_psa10_avg_price_3d,
          snidan_psa10_qty_3d: card?.snidan_psa10_qty_3d || 0,
          snidan_psa9_avg_price_3d: card?.snidan_psa9_avg_price_3d,
          snidan_psa9_qty_3d: card?.snidan_psa9_qty_3d || 0,
          snidan_a_avg_price_3d: card?.snidan_a_avg_price_3d,
          snidan_a_qty_3d: card?.snidan_a_qty_3d || 0,
          snidan_code: card?.snidan_code
        })
      } else {
        results.push({
          specId,
          success: false
        })
      }
    }

    const response = {
      success: true,
      total: specIds.length,
      successCount,
      results
    }
    console.log('[API] Returning:', response)
    return Response.json(response)
  } catch (error) {
    console.error('[API] Error:', error)
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
