import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface SnidanApparel {
  id: number
  localizedName: string
  productNumber: string
  primaryMedia: {
    imageUrl: string
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const testApparelId = searchParams.get('test_apparel_id')

    console.log('[Scrape Variations] Starting variation scraping...')

    let parentIds: string[]

    if (testApparelId) {
      // テスト用：特定のapparel_idのみ
      parentIds = [testApparelId]
      console.log(`[Scrape Variations] Test mode: ${testApparelId}`)
    } else {
      // 親商品IDの一覧を取得（ページネーション対応）
      const allParents: string[] = []
      let offset = 0
      const limit = 1000

      while (true) {
        const { data: parents, error: parentsError } = await supabase
          .from('snidan_cards')
          .select('parent_apparel_id')
          .not('parent_apparel_id', 'is', null)
          .range(offset, offset + limit - 1)

        if (parentsError) {
          throw new Error(parentsError.message)
        }

        if (parents && parents.length > 0) {
          allParents.push(...parents.map(p => p.parent_apparel_id))
          offset += limit
          console.log(`[Scrape Variations] Fetched parents: ${allParents.length} so far...`)
        } else {
          break
        }
      }

      parentIds = Array.from(new Set(allParents))
    }

    console.log(`[Scrape Variations] Found ${parentIds.length} parent products`)

    let processedCount = 0
    let newCount = 0
    let skippedCount = 0

    // 10件ごとに進捗を出力しながら処理
    for (let i = 0; i < parentIds.length; i += 10) {
      const batch = parentIds.slice(i, Math.min(i + 10, parentIds.length))

      for (const parentId of batch) {
        try {
          // 親商品のAPIから productNumber を取得
          const parentApiResponse = await fetch(`https://snkrdunk.com/v1/apparels/${parentId}`)
          const parentData = await parentApiResponse.json()
          const productNumber = parentData.productNumber

          console.log(`[Scrape Variations] Parent ${parentId}: productNumber = ${productNumber}`)

          // そのproductNumberの全バリエーションを取得
          const variationsResponse = await fetch(
            `https://snkrdunk.com/v1/apparels?productNumber=${encodeURIComponent(productNumber)}`
          )
          const variationsData = await variationsResponse.json()
          const apparels: SnidanApparel[] = variationsData.apparels || []

          console.log(`[Scrape Variations] Found ${apparels.length} variations for productNumber ${productNumber}`)

          if (apparels.length === 0) {
            processedCount++
            continue
          }

          // バリエーション先頭のIDを確定
          const firstVariationId = apparels[0].id.toString()

          // 各バリエーションを処理
          for (const apparel of apparels) {
            const apparelIdStr = apparel.id.toString()
            const localizedName = apparel.localizedName

            // 英語版はスキップ
            if (localizedName.includes('【英語版】')) {
              continue
            }

            // 既存確認
            const { data: existing } = await supabase
              .from('snidan_cards')
              .select('id')
              .eq('snidan_apparel_id', apparelIdStr)
              .single()

            if (existing) {
              // 既存 → parent_apparel_idだけ更新
              await supabase
                .from('snidan_cards')
                .update({ parent_apparel_id: firstVariationId })
                .eq('snidan_apparel_id', apparelIdStr)
              skippedCount++
              continue
            }

            // 未登録 → カード名、コード、画像を抽出
            const bracketIndex = localizedName.indexOf('[')
            const cardName = bracketIndex > 0 ? localizedName.substring(0, bracketIndex).trim() : localizedName

            const codeMatch = localizedName.match(/\[([^\]]+)\]/)
            const snidanCode = codeMatch ? codeMatch[1] : null

            const imageUrl = apparel.primaryMedia?.imageUrl || null

            // DB保存
            const { error: insertError } = await supabase
              .from('snidan_cards')
              .insert({
                snidan_apparel_id: apparelIdStr,
                parent_apparel_id: firstVariationId,
                snidan_name_ja: cardName,
                snidan_code: snidanCode,
                snidan_image_url: imageUrl,
                scraped_at: new Date().toISOString()
              })

            if (!insertError) {
              newCount++
            }
          }

          processedCount++
        } catch (err) {
          console.error(`[Scrape Variations] Error processing parent ${parentId}:`, err)
          processedCount++
        }
      }

      // 10件ごとに進捗を出力
      console.log(`[Scrape Variations] Progress: ${Math.min(i + 10, parentIds.length)}/${parentIds.length} parents processed`)
    }

    console.log(`[Scrape Variations] Complete: ${newCount} new variations added, ${skippedCount} existing updated`)

    return Response.json({
      success: true,
      processed: processedCount,
      newVariations: newCount,
      updated: skippedCount
    })
  } catch (error) {
    console.error('[Scrape Variations] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
