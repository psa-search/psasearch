import { NextRequest, NextResponse } from 'next/server'
import { searchCards, getPriceChart, calcTrend, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'
import type { CardWithTrend } from '@/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand = (searchParams.get('brand') as 'pokemon' | 'onepiece') ?? 'pokemon'
  const page = parseInt(searchParams.get('page') ?? '1')

  try {
    const listings = await searchCards(brand, page)

    // 各カードのチャートデータを取得して趋勢計算
    const cards: CardWithTrend[] = await Promise.all(
      listings.slice(0, 20).map(async (listing) => {
        const [chartPsa10, chartPsa9] = await Promise.all([
          getPriceChart(listing.apparelId, CONDITION_PSA10, 'oneMonth'),
          getPriceChart(listing.apparelId, CONDITION_PSA9, 'oneMonth'),
        ])

        const latestPsa10 = chartPsa10.points.at(-1)?.price ?? null
        const latestPsa9 = chartPsa9.points.at(-1)?.price ?? null
        const priceDiff =
          latestPsa10 !== null && latestPsa9 !== null ? latestPsa10 - latestPsa9 : null
        const trendPercent = calcTrend(chartPsa10.points)

        return {
          id: listing.apparelId,
          name: listing.name,
          localizedName: listing.localizedName,
          imageUrl: listing.imageUrl,
          productNumber: listing.productNumber,
          currentPricePsa10: latestPsa10,
          currentPricePsa9: latestPsa9,
          priceDiff,
          trendPercent,
          chartPsa10: chartPsa10.points,
          chartPsa9: chartPsa9.points,
        }
      })
    )

    // 価格上昇率でソート（上昇中を上に）
    cards.sort((a, b) => {
      if (a.trendPercent === null && b.trendPercent === null) return 0
      if (a.trendPercent === null) return 1
      if (b.trendPercent === null) return -1
      return b.trendPercent - a.trendPercent
    })

    return NextResponse.json({ cards, brand, page })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}
