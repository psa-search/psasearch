import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ITEMS_PER_PAGE = 30
const TOTAL_PAGES = 334 // 1万件 ÷ 30

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // キャッシュ確認
    if (!force) {
      const { data: existing } = await supabase
        .from('snidan_cards')
        .select('scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        const scrapedTime = new Date(existing.scraped_at)
        const now = new Date()
        const diffHours = (now.getTime() - scrapedTime.getTime()) / (1000 * 60 * 60)

        if (diffHours < 24) {
          const { count } = await supabase
            .from('snidan_cards')
            .select('*', { count: 'exact', head: true })
          return Response.json({
            success: true,
            count: count || 0,
            from_cache: true,
          })
        }
      }
    }

    // スクレイピング開始
    const allCards: Array<{
      snidan_apparel_id: string
      snidan_name_ja: string
      snidan_code: string | null
      snidan_image_url: string | null
    }> = []

    console.log('[Snidan Scrape] Starting scrape of 334 pages...')

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

        // 商品を抽出
        const productRegex = /<a href="https:\/\/snkrdunk\.com\/apparels\/(\d+)"[^>]+aria-label="([^"]+)"/g
        let match

        while ((match = productRegex.exec(html)) !== null) {
          const apparelId = match[1]
          const ariaLabel = match[2]

          // aria-label から ` - ¥価格` を除去
          const withoutPrice = ariaLabel.replace(/ - ¥[\d,]+$/, '')

          // 最初の角括弧から snidan_code を抽出
          const codeMatch = withoutPrice.match(/^(.+?)\s*\[([^\]]+)\]/)
          let name = withoutPrice
          let code: string | null = null

          if (codeMatch) {
            name = codeMatch[1].trim()
            code = codeMatch[2].trim()
          }

          allCards.push({
            snidan_apparel_id: apparelId,
            snidan_name_ja: name,
            snidan_code: code,
            snidan_image_url: null, // 画像URLは別途取得
          })
        }

        if (page % 50 === 0) {
          console.log(`[Snidan Scrape] Progress: page ${page}/${TOTAL_PAGES}, total cards: ${allCards.length}`)
        }

        // リクエスト制限を避けるため、少し待つ
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error)
      }
    }

    console.log(`[Snidan Scrape] Scraping complete: ${allCards.length} cards`)

    // DB に保存（既存データを削除して一括挿入）
    // 全削除
    await supabase.from('snidan_cards').delete().gt('id', -1)

    const { error: insertError } = await supabase
      .from('snidan_cards')
      .insert(allCards)

    if (insertError) {
      throw new Error(`Failed to insert data: ${insertError.message}`)
    }

    return Response.json({
      success: true,
      count: allCards.length,
      from_cache: false,
    })
  } catch (error) {
    console.error('[Snidan Scrape] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
