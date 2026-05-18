import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CACHE_DURATION_HOURS = 6
const ITEMS_PER_PAGE = 30
const TOTAL_ITEMS = 300
const TOTAL_PAGES = Math.ceil(TOTAL_ITEMS / ITEMS_PER_PAGE)

export async function GET(request: Request) {
  try {
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
    const allItems: Array<{ rank: number; snidan_id: string; card_name: string }> = []

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
          const cardName = ariaLabel.replace(/ - ¥[\d,]+$/, '')

          const rank = allItems.length + 1
          allItems.push({ rank, snidan_id: snidanId, card_name: cardName })

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

    const { error: insertError } = await supabase
      .from('snidan_popular')
      .insert(allItems.slice(0, TOTAL_ITEMS))

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
