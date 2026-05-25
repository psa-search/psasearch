import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const searches = searchParams.getAll('search') || []
    const sortBy = searchParams.get('sortBy') || 'gem_rate_psa10'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const minGem10 = searchParams.get('minGem10') ? parseInt(searchParams.get('minGem10')!) : null
    const minGemRate = searchParams.get('minGemRate') ? parseFloat(searchParams.get('minGemRate')!) : null
    const noImageOnly = searchParams.get('noImageOnly') === 'true'

    // Call RPC function for search
    const { data, error } = await supabase.rpc('search_cards', {
      p_search_terms: searches.length > 0 ? searches : null,
      p_sort_by: sortBy,
      p_order: order,
      p_limit: limit,
      p_offset: offset,
      p_min_gem10: minGem10,
      p_min_gem_rate: minGemRate,
      p_no_image_only: noImageOnly
    })

    if (error) {
      console.error('[Cards API] RPC error:', error)
      return Response.json({ error: error.message, details: JSON.stringify(error) }, { status: 500 })
    }

    if (!data) {
      return Response.json({
        cards: [],
        total: 0
      })
    }

    // data is JSON object with cards and total
    const result = typeof data === 'string' ? JSON.parse(data) : data

    // Convert USD to JPY for display
    const { getDollarRate } = await import('@/lib/exchange-rate')
    const rate = await getDollarRate()

    const cards = (result.cards || []).map((row: any) => {
      const psa10Jpy = row.psa_psa10_avg_price_3d ? Math.round(row.psa_psa10_avg_price_3d * rate) : null
      const psa9Jpy = row.psa_psa9_avg_price_3d ? Math.round(row.psa_psa9_avg_price_3d * rate) : null

      // PSA10/PSA9 price ratio
      let priceDiffRatio: number | null = null
      if (psa10Jpy && psa9Jpy && psa9Jpy > 0) {
        priceDiffRatio = Math.round((psa10Jpy / psa9Jpy) * 100)
      }

      return {
        psa_spec_id: row.psa_spec_id,
        set_id: row.set_id,
        card_number: row.card_number,
        card_name: row.card_name,
        card_name_ja: row.card_name_ja,
        variety: row.variety,
        total_graded: row.total_graded,
        gem_count_psa10: row.gem_count_psa10,
        gem_rate_psa10: row.gem_rate_psa10,
        image_urls: row.image_urls,
        psa_psa10_avg_price_3d: psa10Jpy,
        psa_psa10_qty_3d: row.psa_psa10_qty_3d,
        psa_psa9_avg_price_3d: psa9Jpy,
        psa_psa9_qty_3d: row.psa_psa9_qty_3d,
        priceDiffRatio,
        snidan_apparel_id: row.snidan_apparel_id,
        snidan_psa10_avg_price_3d: row.snidan_psa10_avg_price_3d,
        snidan_psa10_qty_3d: row.snidan_psa10_qty_3d,
        snidan_psa9_avg_price_3d: row.snidan_psa9_avg_price_3d,
        snidan_psa9_qty_3d: row.snidan_psa9_qty_3d,
        snidan_a_avg_price_3d: row.snidan_a_avg_price_3d,
        snidan_a_qty_3d: row.snidan_a_qty_3d,
        snidan_code: row.snidan_code,
        set: {
          set_code: row.set_code
        }
      }
    })

    return Response.json({
      cards,
      total: result.total || 0
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
