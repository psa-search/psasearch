import CardGrid from '@/components/CardGrid'
import type { CardWithTrend } from '@/types'

interface Props {
  searchParams: Promise<{ brand?: string; page?: string }>
}

async function fetchCards(brand: string, page: number): Promise<CardWithTrend[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/cards?brand=${brand}&page=${page}`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.cards ?? []
}

export default async function Home({ searchParams }: Props) {
  const { brand = 'pokemon', page = '1' } = await searchParams
  const currentPage = parseInt(page)
  const cards = await fetchCards(brand, currentPage)

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
