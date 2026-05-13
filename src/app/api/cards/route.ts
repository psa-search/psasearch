import { NextRequest, NextResponse } from 'next/server'
import { searchCards, getSalesHistory, countSalesWithinDays, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'
import type { CardWithTrend, SalesRecord } from '@/types'

function avgPrice(records: SalesRecord[], days: number): number | null {
  const recent = records.filter((r) => r.hoursAgo <= days * 24)
  if (recent.length === 0) return null
  return Math.round(recent.reduce((s, r) => s + r.price, 0) / recent.length)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand = (searchParams.get('brand') as 'pokemon' | 'onepiece') ?? 'pokemon'
  const page = parseInt(searchParams.get('page') ?? '1')

  try {
    const listings = await searchCards(brand, page)

    const cards: CardWithTrend[] = await Promise.all(
      listings.slice(0, 20).map(async (listing) => {
        const [historyPsa10, historyPsa9] = await Promise.all([
          getSalesHistory(listing.apparelId, CONDITION_PSA10),
          getSalesHistory(listing.apparelId, CONDITION_PSA9),
        ])

        const avgPricePsa10 = avgPrice(historyPsa10, 3)
        const avgPricePsa9 = avgPrice(historyPsa9, 3)
        const priceDiff =
          avgPricePsa10 !== null && avgPricePsa9 !== null ? avgPricePsa10 - avgPricePsa9 : null

        return {
          id: listing.apparelId,
          name: listing.name,
          localizedName: listing.localizedName,
          imageUrl: listing.imageUrl,
          productNumber: listing.productNumber,
          avgPricePsa10,
          avgPricePsa9,
          priceDiff,
          salesCount3dPsa10: countSalesWithinDays(historyPsa10, 3),
          salesCount3dPsa9: countSalesWithinDays(historyPsa9, 3),
        }
      })
    )

    cards.sort((a, b) => b.salesCount3dPsa10 - a.salesCount3dPsa10)

    return NextResponse.json({ cards, brand, page })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}
