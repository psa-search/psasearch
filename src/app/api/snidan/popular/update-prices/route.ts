import { createClient } from '@supabase/supabase-js'
import { getSalesHistory, CONDITION_PSA10, CONDITION_PSA9, CONDITION_A } from '@/lib/snidan'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function fetchSnidanPrices(apparelId: string, grade: 10 | 9 | 18): Promise<{ quantity: number; averagePrice: number } | null> {
  try {
    const conditionId = grade === 10 ? CONDITION_PSA10 : grade === 9 ? CONDITION_PSA9 : CONDITION_A

    // キャッシュテーブルから該当レコードを削除
    try {
      await supabase.from('snidan_sales_history')
        .delete()
        .eq('apparel_id', parseInt(apparelId))
        .eq('condition_id', conditionId)
    } catch (e) {
      console.log(`[fetchSnidanPrices] Cache clear failed for apparel=${apparelId}, condition=${conditionId}`)
    }

    const records = await getSalesHistory(parseInt(apparelId), conditionId)

    // 直近10日（240時間以内）の成約レコードを抽出
    const recentRecords = records.filter(r => r.hoursAgo <= 240)

    if (recentRecords.length === 0) {
      // 直近10日にデータがない場合、全データから最新を取得
      if (records.length > 0) {
        const record = records[0]
        return {
          quantity: -Math.floor(new Date(record.soldAt).getTime() / 1000),
          averagePrice: record.price,
        }
      }
      return null
    }

    const totalPrice = recentRecords.reduce((sum, r) => sum + r.price, 0)
    return {
      quantity: recentRecords.length,
      averagePrice: Math.round(totalPrice / recentRecords.length),
    }
  } catch (error) {
    console.error(`[fetchSnidanPrices] Error for apparelId=${apparelId}, grade=${grade}:`, error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const { snidanIds } = await request.json()

    if (!Array.isArray(snidanIds) || snidanIds.length === 0) {
      return Response.json(
        { error: 'snidanIds must be a non-empty array' },
        { status: 400 }
      )
    }

    const results = []
    let successCount = 0

    for (const snidanId of snidanIds) {
      try {
        // Snidan API から画像URL取得
        const detailResponse = await fetch(`https://snkrdunk.com/v1/apparels/${snidanId}`, {
          headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        })

        const updateData: any = {}

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          if (detailData.primaryMedia && detailData.primaryMedia.imageUrl) {
            updateData.snidan_image_url = detailData.primaryMedia.imageUrl
          }
        }

        // 販売履歴から価格取得
        const psa10Prices = await fetchSnidanPrices(snidanId, 10)
        const psa9Prices = await fetchSnidanPrices(snidanId, 9)
        const aPrices = await fetchSnidanPrices(snidanId, 18)

        if (psa10Prices) {
          updateData.snidan_psa10_avg_price_3d = psa10Prices.averagePrice
          updateData.snidan_psa10_qty_3d = psa10Prices.quantity
        }

        if (psa9Prices) {
          updateData.snidan_psa9_avg_price_3d = psa9Prices.averagePrice
          updateData.snidan_psa9_qty_3d = psa9Prices.quantity
        }

        if (aPrices) {
          updateData.snidan_a_avg_price_3d = aPrices.averagePrice
          updateData.snidan_a_qty_3d = aPrices.quantity
        }

        // snidan_popular を更新
        const { error: updateError } = await supabase
          .from('snidan_popular')
          .update(updateData)
          .eq('snidan_id', snidanId)

        if (updateError) {
          console.error(`Failed to update snidan_popular for ${snidanId}:`, updateError)
          results.push({ snidanId, success: false })
        } else {
          successCount++
          results.push({ snidanId, success: true, ...updateData })
        }
      } catch (error) {
        console.error(`Error processing snidanId ${snidanId}:`, error)
        results.push({ snidanId, success: false })
      }
    }

    return Response.json({
      success: true,
      total: snidanIds.length,
      successCount,
      results,
    })
  } catch (error) {
    console.error('[Snidan Popular Update Prices] Error:', error)
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
