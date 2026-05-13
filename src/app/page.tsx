import CardGrid from '@/components/CardGrid'
import { searchCards, getSalesHistory, countSalesWithinDays, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'
import type { CardWithTrend, SalesRecord } from '@/types'

interface Props {
  searchParams: Promise<{ brand?: string; page?: string; search?: string }>
}

function avgPrice(records: SalesRecord[], days: number): number | null {
  const recent = records.filter((r) => r.hoursAgo <= days * 24)
  if (recent.length === 0) return null
  return Math.round(recent.reduce((s, r) => s + r.price, 0) / recent.length)
}

async function getCards(brand: 'pokemon' | 'onepiece', page: number, keyword?: string): Promise<CardWithTrend[]> {
  try {
    const listings = await searchCards(brand, page, keyword)

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

    // 直近3日のPSA10販売数が多い順
    cards.sort((a, b) => b.salesCount3dPsa10 - a.salesCount3dPsa10)

    return cards
  } catch {
    return []
  }
}

export default async function Home({ searchParams }: Props) {
  const { brand = 'pokemon', page = '1', search } = await searchParams
  const currentPage = parseInt(page)
  const cards = await getCards(brand as 'pokemon' | 'onepiece', currentPage, search)

  return (
    <main className="min-h-screen">
      {/* ヘッダ */}
      <div className="header">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">PSA10 価格トレンド</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 検索フォーム */}
        <form className="flex gap-2 w-full sm:w-96 items-center mb-6">
            {/* 虫眼鏡アイコン */}
            <div className="flex items-center justify-center flex-shrink-0 text-gray-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>

            {/* 検索入力 */}
            <input
              type="text"
              name="search"
              defaultValue={search || ''}
              placeholder="カード検索..."
              className="flex-1 px-4 py-2 text-sm text-black placeholder-gray-400 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
            />

            <input type="hidden" name="brand" value={brand} />
            <input type="hidden" name="page" value="1" />

            {/* 検索ボタン */}
            <button
              type="submit"
              className="px-6 py-2 bg-white border border-gray-300 text-black text-sm font-medium whitespace-nowrap rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              検索
            </button>

            {search && (
              <a
                href={`/?brand=${brand}&page=1`}
                className="px-2 py-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
              >
                ✕
              </a>
            )}
          </form>

        {/* 最終更新日 */}
        <div className="text-xs text-gray-500 mb-4">
          最終更新: {new Date().toLocaleString('ja-JP')}
        </div>

        {/* ブランド切り替え */}
        <div className="flex gap-4 mb-6">
          {[
            { key: 'pokemon', label: 'ポケモンカード' },
            { key: 'onepiece', label: 'ワンピースカード' },
          ].map(({ key, label }) => (
            <a
              key={key}
              href={`/?brand=${key}&page=1${search ? `&search=${encodeURIComponent(search)}` : ''}`}
              className={`px-0 py-2 text-sm transition-colors pb-2 ${
                brand === key
                  ? 'text-black font-bold border-b-[2px] border-black'
                  : 'text-gray-600 hover:text-gray-800'
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
              href={`/?brand=${brand}&page=${currentPage - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
            >
              ← 前へ
            </a>
          )}
          <span className="px-4 py-2 text-gray-600 text-sm">{currentPage} ページ</span>
          <a
            href={`/?brand=${brand}&page=${currentPage + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
          >
            次へ →
          </a>
        </div>
      </div>
    </main>
  )
}
