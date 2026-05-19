import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    // キャッシュの確認
    const { data: existing } = await supabase
      .from('snidan_popular')
      .select('cached_at')
      .order('cached_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const cachedTime = new Date(existing.cached_at)
      const now = new Date()
      const diffHours = (now.getTime() - cachedTime.getTime()) / (1000 * 60 * 60)

      if (diffHours >= 6) {
        // キャッシュが古い → fetch-popular を内部呼び出し
        try {
          await fetch(`${request.url.split('/api/')[0]}/api/snidan/fetch-popular`)
        } catch (error) {
          console.error('Error refreshing popular cache:', error)
        }
      }
    }

    // snidan_popular を rank 順に取得
    const { data: popularItems, error } = await supabase
      .from('snidan_popular')
      .select('rank, snidan_id, card_name, snidan_code')
      .order('rank', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(error.message)
    }

    if (!popularItems || popularItems.length === 0) {
      return Response.json({
        items: [],
        total: 0,
      })
    }

    // snidan_id で psa_cards を LEFT JOIN（整数に変換）
    const snidanIds = popularItems.map(item => parseInt(item.snidan_id))
    console.log('[Snidan Popular] snidanIds:', snidanIds.slice(0, 5))

    const { data: psaCards, error: joinError } = await supabase
      .from('psa_cards')
      .select(`
        psa_spec_id, set_id, card_number, card_name, card_name_ja, variety,
        total_graded, gem_count_psa10, gem_rate_psa10, image_urls,
        psa_psa10_avg_price_3d, psa_psa10_qty_3d, psa_psa9_avg_price_3d, psa_psa9_qty_3d,
        snidan_apparel_id, snidan_psa10_avg_price_3d, snidan_psa10_qty_3d,
        snidan_psa9_avg_price_3d, snidan_psa9_qty_3d, snidan_a_avg_price_3d, snidan_a_qty_3d, snidan_code
      `)
      .in('snidan_apparel_id', snidanIds)

    console.log('[Snidan Popular] Found psaCards:', psaCards?.length || 0, 'Error:', joinError)

    // set_code を取得するために psa_sets を取得
    let setMap = new Map()
    if (psaCards && psaCards.length > 0) {
      const setIds = [...new Set(psaCards.map((card: any) => card.set_id))]
      const { data: sets } = await supabase
        .from('psa_sets')
        .select('psa_spec_id, set_code')
        .in('psa_spec_id', setIds)

      sets?.forEach((set: any) => {
        setMap.set(set.psa_spec_id, set.set_code)
      })
    }

    // USD を JPY に変換
    const { getDollarRate } = await import('@/lib/exchange-rate')
    const rate = await getDollarRate()

    const psaCardMap = new Map()
    psaCards?.forEach((card: any) => {
      // set オブジェクトを作成
      card.set = { set_code: setMap.get(card.set_id) || '?' }

      // 公式価格を USD → JPY に変換
      if (card.psa_psa10_avg_price_3d) {
        card.psa_psa10_avg_price_3d = Math.round(card.psa_psa10_avg_price_3d * rate)
      }
      if (card.psa_psa9_avg_price_3d) {
        card.psa_psa9_avg_price_3d = Math.round(card.psa_psa9_avg_price_3d * rate)
      }

      psaCardMap.set(card.snidan_apparel_id, card)
    })

    // マージ - snidan_code を使用
    const items = popularItems.map(item => {
      const snidanIdInt = parseInt(item.snidan_id)
      return {
        rank: item.rank,
        snidan_id: item.snidan_id,
        card_name_short: item.card_name,
        snidan_code: item.snidan_code,
        psa_card: psaCardMap.get(snidanIdInt) || null,
      }
    })

    // 総数を取得
    const { count: total } = await supabase
      .from('snidan_popular')
      .select('*', { count: 'exact', head: true })

    return Response.json({
      items,
      total: total || 0,
    })
  } catch (error) {
    console.error('[Snidan Popular] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
