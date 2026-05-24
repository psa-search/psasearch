import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CACHE_DURATION_HOURS = 6
const ITEMS_PER_PAGE = 30
const TOTAL_ITEMS = 200
const TOTAL_PAGES = Math.ceil(TOTAL_ITEMS / ITEMS_PER_PAGE)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // キャッシュの確認
    const { data: existing } = await supabase
      .from('snidan_popular')
      .select('cached_at')
      .order('cached_at', { ascending: false })
      .limit(1)
      .single()

    if (!force && existing) {
      const cachedTime = new Date(existing.cached_at)
      const now = new Date()
      const diffHours = (now.getTime() - cachedTime.getTime()) / (1000 * 60 * 60)

      if (diffHours < CACHE_DURATION_HOURS) {
        // キャッシュはまだ有効
        const { data: cached, error } = await supabase
          .from('snidan_popular')
          .select('*')
          .order('rank', { ascending: true })

        if (!error && cached) {
          return Response.json({
            success: true,
            count: cached.length,
            from_cache: true,
          })
        }
      }
    }

    // キャッシュが無い or 古い → 取得開始
    const allItems: Array<{
      rank: number
      snidan_id: string
      card_name: string
      snidan_code: string | null
      snidan_image_url?: string | null
      snidan_psa10_avg_price_3d?: number | null
      snidan_psa10_qty_3d?: string | null
      snidan_psa9_avg_price_3d?: number | null
      snidan_psa9_qty_3d?: string | null
      snidan_a_avg_price_3d?: number | null
      snidan_a_qty_3d?: string | null
    }> = []

    for (let page = 1; page <= TOTAL_PAGES; page++) {
      try {
        const url = `https://snkrdunk.com/search?searchCategoryIds=6%2F33&brandIds=pokemon&sort=hottest&itemSizes=quantity_1&isSaleOnly=&page=${page}`

        const response = await fetch(url, {
          headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
            'accept': 'text/html,application/xhtml+xml,application/xml',
          },
        })

        if (!response.ok) {
          console.error(`Failed to fetch page ${page}: ${response.status}`)
          continue
        }

        const html = await response.text()

        // 正規表現で商品を抽出
        const productRegex = /<a href="https:\/\/snkrdunk\.com\/apparels\/(\d+)"[^>]+aria-label="([^"]+)"/g
        let match

        while ((match = productRegex.exec(html)) !== null) {
          const snidanId = match[1]
          const ariaLabel = match[2]

          // aria-label から ` - ¥価格` を除去
          const withoutPrice = ariaLabel.replace(/ - ¥[\d,]+$/, '')

          // 最初の角括弧から snidan_code を抽出
          const codeMatch = withoutPrice.match(/^(.+?)\s*\[([^\]]+)\]/)
          let cardName = withoutPrice
          let snidanCode: string | null = null

          if (codeMatch) {
            cardName = codeMatch[1].trim()
            snidanCode = codeMatch[2].trim()
          }

          const rank = allItems.length + 1
          const item: any = { rank, snidan_id: snidanId, card_name: cardName, snidan_code: snidanCode }

          // 詳細情報を API から取得
          try {
            const detailResponse = await fetch(`https://snkrdunk.com/v1/apparels/${snidanId}`, {
              headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              },
            })

            if (detailResponse.ok) {
              const detailData = await detailResponse.json()

              // 画像URLを抽出
              if (detailData.primaryMedia && detailData.primaryMedia.imageUrl) {
                item.snidan_image_url = detailData.primaryMedia.imageUrl
              }

              // 直近3日の価格情報を取得（API データから）
              if (detailData.priceHistory && detailData.priceHistory.length > 0) {
                const prices = detailData.priceHistory
                item.snidan_psa10_avg_price_3d = prices.psa10_avg || null
                item.snidan_psa10_qty_3d = prices.psa10_qty || null
                item.snidan_psa9_avg_price_3d = prices.psa9_avg || null
                item.snidan_psa9_qty_3d = prices.psa9_qty || null
                item.snidan_a_avg_price_3d = prices.a_avg || null
                item.snidan_a_qty_3d = prices.a_qty || null
              }
            }
          } catch (detailError) {
            console.error(`Failed to fetch details for ${snidanId}:`, detailError)
          }

          allItems.push(item)

          if (allItems.length >= TOTAL_ITEMS) break
        }

        if (allItems.length >= TOTAL_ITEMS) break

        // リクエスト制限を避けるため、少し待つ
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error)
      }
    }

    // DB に保存（既存データを削除して一括挿入）
    await supabase.from('snidan_popular').delete().gte('rank', 0)

    const itemsToInsert = allItems.slice(0, TOTAL_ITEMS).map(item => ({
      rank: item.rank,
      snidan_id: item.snidan_id,
      card_name: item.card_name,
      snidan_code: item.snidan_code,
      snidan_image_url: item.snidan_image_url || null,
      snidan_psa10_avg_price_3d: item.snidan_psa10_avg_price_3d || null,
      snidan_psa10_qty_3d: item.snidan_psa10_qty_3d || null,
      snidan_psa9_avg_price_3d: item.snidan_psa9_avg_price_3d || null,
      snidan_psa9_qty_3d: item.snidan_psa9_qty_3d || null,
      snidan_a_avg_price_3d: item.snidan_a_avg_price_3d || null,
      snidan_a_qty_3d: item.snidan_a_qty_3d || null,
    }))

    const { error: insertError } = await supabase
      .from('snidan_popular')
      .insert(itemsToInsert)

    if (insertError) {
      throw new Error(`Failed to insert data: ${insertError.message}`)
    }

    return Response.json({
      success: true,
      count: Math.min(allItems.length, TOTAL_ITEMS),
      from_cache: false,
    })
  } catch (error) {
    console.error('[Snidan Fetch Popular] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
