import CardGrid from '@/components/CardGrid'
import { searchCards, getPriceChart, calcTrend, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'
import type { CardWithTrend } from '@/types'

interface Props {
  searchParams: Promise<{ brand?: string; page?: string }>
}

async function getCards(brand: 'pokemon' | 'onepiece', page: number): Promise<CardWithTrend[]> {
  try {
    const listings = await searchCards(brand, page)

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

    cards.sort((a, b) => {
      if (a.trendPercent === null && b.trendPercent === null) return 0
      if (a.trendPercent === null) return 1
      if (b.trendPercent === null) return -1
      return b.trendPercent - a.trendPercent
    })

    return cards
  } catch {
    return []
  }
}

export default async function Home({ searchParams }: Props) {
  const { brand = 'pokemon', page = '1' } = await searchParams
  const currentPage = parseInt(page)
  const cards = await getCards(brand as 'pokemon' | 'onepiece', currentPage)

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-amber-400">PSA10 価格トレンド</h1>

        {/* ブランド切り替え */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'pokemon', label: 'ポケモンカード' },
            { key: 'onepiece', label: 'ワンピースカード' },
          ].map(({ key, label }) => (
            <a
              key={key}
              href={`/?brand=${key}&page=1`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                brand === key
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <CardGrid cards={cards} />

        {/* ページネーション */}
        <div className="flex justify-center gap-4 mt-8">
          {currentPage > 1 && (
            <a
              href={`/?brand=${brand}&page=${currentPage - 1}`}
              className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
            >
              ← 前へ
            </a>
          )}
          <span className="px-4 py-2 text-gray-400 text-sm">{currentPage} ページ</span>
          <a
            href={`/?brand=${brand}&page=${currentPage + 1}`}
            className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
          >
            次へ →
          </a>
        </div>
      </div>
    </main>
  )
}
