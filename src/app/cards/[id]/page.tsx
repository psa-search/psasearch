'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PriceChart from '@/components/PriceChart'
import type { PricePoint, SalesRecord } from '@/types'

interface CardDetail {
  apparelId: number
  cardName: string | null
  cardImageUrl: string | null
  chartPsa10All: PricePoint[]
  chartPsa9All: PricePoint[]
  chartPsa10Month: PricePoint[]
  chartPsa9Month: PricePoint[]
  chartPsa10ThreeMonths: PricePoint[]
  chartPsa9ThreeMonths: PricePoint[]
  hasThreeMonths: boolean
  salesHistoryPsa10: SalesRecord[]
  salesHistoryPsa9: SalesRecord[]
  salesCount3dPsa10: number
  salesCount3dPsa9: number
  usdJpyRate: number
  psaMetrics?: {
    spec_id: string
    total_grading_count: number | null
    grade10_gem_count: number | null
    grade10_price_history: Array<{ date: string; price: number | null }>
    grade10_auction_sales: Array<{ date: string; price: number | null }>
    grade9_gem_count: number | null
    grade9_price_history: Array<{ date: string; price: number | null }>
    grade9_auction_sales: Array<{ date: string; price: number | null }>
    last_updated: string
  }
}

type Range = 'month' | 'threeMonths' | 'sixMonths'

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'month', label: '1ヶ月' },
  { key: 'threeMonths', label: '3ヶ月' },
  { key: 'sixMonths', label: '6ヶ月' },
]

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<CardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('month')
  const [historyTab, setHistoryTab] = useState<'psa10' | 'psa9'>('psa10')
  const [psaCurrencyTab, setPsaCurrencyTab] = useState<'usd' | 'jpy'>('jpy')
  const [search, setSearch] = useState('')

  const handleHistoryGradeChange = (grade: 'psa10' | 'psa9') => {
    setHistoryTab(grade)
  }

  useEffect(() => {
    fetch(`/api/cards/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (detail?.cardName) {
      const cleaned = detail.cardName.split('の新品')[0].split('の中古')[0]
      document.title = cleaned || `カード #${id}`
    }
  }, [detail?.cardName, id])

  const getPsa10 = (r: Range): PricePoint[] => {
    if (!detail) return []
    switch (r) {
      case 'month': return detail.chartPsa10Month
      case 'threeMonths': return detail.chartPsa10ThreeMonths
      case 'sixMonths': return detail.chartPsa10All
      default: return detail.chartPsa10Month
    }
  }

  const getPsa9 = (r: Range): PricePoint[] => {
    if (!detail) return []
    switch (r) {
      case 'month': return detail.chartPsa9Month
      case 'threeMonths': return detail.chartPsa9ThreeMonths
      case 'sixMonths': return detail.chartPsa9All
      default: return detail.chartPsa9Month
    }
  }

  const psa10 = getPsa10(range)
  const psa9 = getPsa9(range)

  const latestPsa10 = detail?.chartPsa10All?.at(-1)?.price ?? null
  const latestPsa9 = detail?.chartPsa9All?.at(-1)?.price ?? null

  const extractedCardName = detail?.cardName?.split(/[（(]/)[0]?.trim() || null
  const extractedSetName = detail?.cardName?.match(/[（(]([^）)]+)[）)]/)?.[1] || null

  const visibleOptions = RANGE_OPTIONS.filter(
    (o) => (o.key !== 'threeMonths' || detail?.hasThreeMonths)
  )

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  return (
    <main className="min-h-screen bg-white">
      {/* ヘッダ */}
      <div className="header">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">PSA10 価格トレンド</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 検索フォーム */}
        <form className="flex gap-2 w-full sm:w-auto items-center mb-6">
          <div className="flex items-center justify-center flex-shrink-0 text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>

          <input
            type="text"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="カード検索..."
            className="flex-1 px-4 py-2 text-sm text-black placeholder-gray-400 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
          />

          <button
            type="submit"
            className="px-6 py-2 bg-white border border-gray-300 text-black text-sm font-medium whitespace-nowrap rounded-full hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            検索
          </button>

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="px-2 py-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              ✕
            </button>
          )}
        </form>

        {loading && <p className="text-gray-600">読み込み中...</p>}

        {detail && (
          <>
            {/* パンくず */}
            <div className="text-sm text-gray-600 mb-6 truncate">
              <Link href="/" className="hover:text-gray-900">TOP</Link>
              <span className="mx-2">{'>'}</span>
              <span>ポケカ</span>
              <span className="mx-2">{'>'}</span>
              <span className="truncate">{truncateText(extractedSetName || 'セット', 20)}</span>
              <span className="mx-2">{'>'}</span>
              <span className="truncate">{truncateText(extractedCardName || `カード #${id}`, 20)}</span>
            </div>

            {/* スマホレイアウト */}
            <div className="sm:hidden space-y-6">
              {/* 画像 */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                {detail.cardImageUrl ? (
                  <img
                    src={detail.cardImageUrl}
                    alt={extractedCardName || 'Card'}
                    className="w-full h-auto object-contain"
                  />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center text-gray-400 text-sm">
                    画像なし
                  </div>
                )}
              </div>

              {/* カード名 */}
              <h1 className="text-xl font-bold !text-black">
                {extractedCardName || `カード #${id}`}
              </h1>

              {/* セット名 */}
              {extractedSetName && (
                <p className="text-gray-600 text-sm">
                  {extractedSetName}
                </p>
              )}

              {/* 直近3日の販売数 */}
              <div className="bg-gray-100 rounded-lg p-4">
                <p className="text-gray-600 text-sm mb-2">直近3日の販売数</p>
                <p className="text-black">
                  <span className="font-bold text-red-600">PSA10: {detail.salesCount3dPsa10}</span>
                  <span className="text-gray-600 mx-2">/</span>
                  <span className="font-bold">PSA9: {detail.salesCount3dPsa9}</span>
                </p>
              </div>

              {/* 10/9の価格、価格差 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-gray-600 text-sm mb-1">PSA10 直近価格</p>
                  <p className="text-lg font-bold text-black">
                    {latestPsa10 ? `¥${latestPsa10.toLocaleString()}` : '―'}
                  </p>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-gray-600 text-sm mb-1">PSA9 直近価格</p>
                  <p className="text-lg font-bold text-black">
                    {latestPsa9 ? `¥${latestPsa9.toLocaleString()}` : '―'}
                  </p>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-gray-600 text-sm mb-1">価格差</p>
                  <p className="text-lg font-bold text-blue-600">
                    {latestPsa10 !== null && latestPsa9 !== null
                      ? `¥${(latestPsa10 - latestPsa9).toLocaleString()}`
                      : '―'}
                  </p>
                </div>
              </div>

              {/* チャート */}
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-black">価格推移</h3>
                  <div className="flex gap-1">
                    {visibleOptions.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setRange(key)}
                        className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                          range === key
                            ? 'text-black font-bold border-black'
                            : 'text-gray-600 hover:text-gray-900 border-transparent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart
                  psa10={psa10}
                  psa9={psa9}
                  psa10Official={detail?.psaMetrics?.grade10_price_history?.map((p) => ({
                    date: p.date,
                    price: p.price !== null ? p.price * detail.usdJpyRate : null,
                  }))}
                  psa9Official={detail?.psaMetrics?.grade9_price_history?.map((p) => ({
                    date: p.date,
                    price: p.price !== null ? p.price * detail.usdJpyRate : null,
                  }))}
                  height={250}
                />
              </div>

              {/* スニダン販売履歴 */}
              {(detail?.salesHistoryPsa10?.length > 0 || detail?.salesHistoryPsa9?.length > 0) && (
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-medium text-black">スニダン販売履歴</h3>
                    <div className="flex gap-1">
                      {(['psa10', 'psa9'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setHistoryTab(tab)}
                          className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                            historyTab === tab
                              ? 'text-black font-bold border-black'
                              : 'text-gray-600 hover:text-gray-900 border-transparent'
                          }`}
                        >
                          {tab === 'psa10' ? 'PSA10' : 'PSA9'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-100">
                        <tr className="text-gray-600 border-b border-gray-300">
                          <th className="text-right pb-0.5">¥</th>
                          <th className="text-right pb-0.5">日時</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(historyTab === 'psa10' ? detail.salesHistoryPsa10 : detail.salesHistoryPsa9)
                          .slice(0, 20)
                          .map((record, i) => (
                            <tr key={i} className="border-b border-gray-300 last:border-0">
                              <td className="py-0.5 text-right font-medium text-black">
                                ¥{record.price.toLocaleString()}
                              </td>
                              <td className="py-0.5 text-right text-gray-600 text-xs">
                                {record.date.slice(0, 5)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PSA販売履歴 */}
              {detail.psaMetrics &&
                (detail.psaMetrics.grade10_auction_sales?.length > 0 || detail.psaMetrics.grade9_auction_sales?.length > 0) && (
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-medium text-black">PSA公式販売履歴</h3>
                      <div className="flex gap-1">
                        {(['psa10', 'psa9'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => handleHistoryGradeChange(tab)}
                            className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                              historyTab === tab
                                ? 'text-black font-bold border-black'
                                : 'text-gray-600 hover:text-gray-900 border-transparent'
                            }`}
                          >
                            {tab === 'psa10' ? 'PSA10' : 'PSA9'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-100">
                          <tr className="text-gray-600 border-b border-gray-300">
                            <th className="text-right pb-0.5">価格</th>
                            <th className="text-right pb-0.5">日時</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(historyTab === 'psa10'
                            ? detail.psaMetrics.grade10_auction_sales
                            : detail.psaMetrics.grade9_auction_sales
                          )
                            ?.slice(0, 20)
                            .map((sale, i) => {
                              const price = sale.price
                              if (price === null) return null
                              const displayPrice = psaCurrencyTab === 'jpy' && detail.usdJpyRate
                                ? (price * detail.usdJpyRate).toLocaleString('ja-JP', { maximumFractionDigits: 0 })
                                : price.toFixed(0)
                              const currencySymbol = psaCurrencyTab === 'jpy' ? '¥' : '$'
                              return (
                                <tr key={i} className="border-b border-gray-300 last:border-0">
                                  <td className="py-0.5 text-right font-medium text-black">
                                    {currencySymbol}{displayPrice}
                                  </td>
                                  <td className="py-0.5 text-right text-gray-600 text-xs">
                                    {new Date(sale.date).toLocaleDateString('ja-JP', {
                                      month: '2-digit',
                                      day: '2-digit',
                                    })}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>

            {/* PC レイアウト */}
            <div className="hidden sm:block">
              <div className="bg-white rounded-xl border border-gray-300 p-6 mb-6">
                <div className="flex gap-6">
                  {/* 左：カード画像 */}
                  <div className="flex-shrink-0 w-80 h-full">
                    {detail.cardImageUrl ? (
                      <img
                        src={detail.cardImageUrl}
                        alt={extractedCardName || 'Card'}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 text-xs">
                        画像なし
                      </div>
                    )}
                  </div>

                  {/* 右：カード情報 + 統計 + メトリクス + チャート */}
                  <div className="flex-1 flex flex-col">
                    {/* カード情報 */}
                    <div className="mb-6">
                      <h1 className="text-lg font-bold text-black mb-2">
                        {extractedCardName || `カード #${id}`}
                      </h1>
                      {extractedSetName && (
                        <p className="text-sm text-gray-600 mb-3">
                          ({extractedSetName})
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-3">
                        <span className="text-gray-600">直近3日の販売数：</span>
                        <span className="text-gray-600 text-xs mx-1">PSA10</span>
                        <span className="text-red-600 font-semibold">{detail.salesCount3dPsa10}</span>
                        <span className="text-gray-600 text-xs mx-1">/</span>
                        <span className="text-gray-600 text-xs">PSA9</span>
                        <span className="text-black font-semibold ml-1">{detail.salesCount3dPsa9}</span>
                      </p>
                    </div>

                    {/* グレーティング統計 */}
                    {detail.psaMetrics && (
                      <div className="grid grid-cols-3 gap-2 mb-6">
                        <div className="bg-gray-100 rounded-lg p-2">
                          <p className="text-xs text-gray-600 mb-1">グレーティング総数</p>
                          <p className="text-lg font-bold text-black">
                            {detail.psaMetrics.total_grading_count ?? '―'}
                          </p>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-2">
                          <p className="text-xs text-gray-600 mb-1">PSA10 の枚数</p>
                          <p className="text-sm font-bold text-black">
                            {detail.psaMetrics.grade10_gem_count ?? '―'}
                          </p>
                          {detail.psaMetrics.total_grading_count && detail.psaMetrics.grade10_gem_count && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              GEM: {((detail.psaMetrics.grade10_gem_count / detail.psaMetrics.total_grading_count) * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                        <div className="bg-gray-100 rounded-lg p-2">
                          <p className="text-xs text-gray-600 mb-1">PSA9 の枚数</p>
                          <p className="text-sm font-bold text-black">
                            {detail.psaMetrics.grade9_gem_count ?? '―'}
                          </p>
                          {detail.psaMetrics.total_grading_count && detail.psaMetrics.grade9_gem_count && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              GEM: {((detail.psaMetrics.grade9_gem_count / detail.psaMetrics.total_grading_count) * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3つのメトリクスグリッド */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-100 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">PSA10 直近価格</p>
                        <p className="text-lg font-bold text-black">
                          {latestPsa10 ? `¥${latestPsa10.toLocaleString()}` : '―'}
                        </p>
                      </div>
                      <div className="bg-gray-100 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">PSA9 直近価格</p>
                        <p className="text-lg font-bold text-black">
                          {latestPsa9 ? `¥${latestPsa9.toLocaleString()}` : '―'}
                        </p>
                      </div>
                      <div className="bg-gray-100 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">PSA10-9 価格差</p>
                        <p className="text-lg font-bold text-blue-600">
                          {latestPsa10 !== null && latestPsa9 !== null
                            ? `¥${(latestPsa10 - latestPsa9).toLocaleString()}`
                            : '―'}
                        </p>
                      </div>
                    </div>

                    {/* チャート */}
                    <div className="mt-6 flex-1 bg-gray-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-black">
                          価格推移
                          {detail?.usdJpyRate && (
                            <span className="text-xs text-gray-600 ml-2">
                              （$1=¥{detail.usdJpyRate.toFixed(2)}換算）
                            </span>
                          )}
                      </h3>
                      <div className="flex gap-1">
                        {visibleOptions.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setRange(key)}
                            className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                              range === key
                                ? 'text-black font-bold border-black'
                                : 'text-gray-600 hover:text-gray-900 border-transparent'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PriceChart
                      psa10={psa10}
                      psa9={psa9}
                      psa10Official={detail?.psaMetrics?.grade10_price_history?.map((p) => ({
                        date: p.date,
                        price: p.price !== null ? p.price * detail.usdJpyRate : null,
                      }))}
                      psa9Official={detail?.psaMetrics?.grade9_price_history?.map((p) => ({
                        date: p.date,
                        price: p.price !== null ? p.price * detail.usdJpyRate : null,
                      }))}
                      height={250}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 販売履歴 */}
            <div className="mt-6">
              <h2 className="text-sm font-medium text-black mb-3">販売履歴</h2>
              <div className="grid grid-cols-2 gap-3">
                {/* Snidan 販売履歴 */}
                {(detail?.salesHistoryPsa10?.length > 0 || detail?.salesHistoryPsa9?.length > 0) && (
                  <div className="bg-gray-100 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xs font-medium text-black">スニダン</h3>
                      <div className="flex gap-1">
                        {(['psa10', 'psa9'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setHistoryTab(tab)}
                            className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                              historyTab === tab
                                ? 'text-black font-bold border-black'
                                : 'text-gray-600 hover:text-gray-900 border-transparent'
                            }`}
                          >
                            {tab === 'psa10' ? 'PSA10' : 'PSA9'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-100">
                          <tr className="text-gray-600 border-b border-gray-300">
                            <th className="text-right pb-0.5 text-2xs">¥</th>
                            <th className="text-right pb-0.5 text-2xs">日時</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(historyTab === 'psa10' ? detail.salesHistoryPsa10 : detail.salesHistoryPsa9)
                            .slice(0, 20)
                            .map((record, i) => (
                              <tr key={i} className="border-b border-gray-300/30 last:border-0">
                                <td className="py-0.5 text-right font-medium text-black text-2xs">
                                  ¥{record.price.toLocaleString()}
                                </td>
                                <td className="py-0.5 text-right text-gray-600 text-2xs">
                                  {record.date.slice(0, 5)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* PSA 公式販売履歴 */}
                {detail.psaMetrics &&
                  (detail.psaMetrics.grade10_auction_sales?.length > 0 || detail.psaMetrics.grade9_auction_sales?.length > 0) && (
                    <div className="bg-gray-100 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xs font-medium text-black">PSA公式</h3>
                        <div className="flex gap-1">
                          {(['psa10', 'psa9'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => handleHistoryGradeChange(tab)}
                              className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                                historyTab === tab
                                  ? 'text-black font-bold border-black'
                                  : 'text-gray-600 hover:text-gray-900 border-transparent'
                              }`}
                            >
                              {tab === 'psa10' ? 'PSA10' : 'PSA9'}
                            </button>
                          ))}
                        </div>
                        <div className="ml-auto flex gap-1">
                          {(['jpy', 'usd'] as const).map((curr) => (
                            <button
                              key={curr}
                              onClick={() => setPsaCurrencyTab(curr)}
                              className={`px-2 py-0.5 text-xs transition-colors pb-1 border-b-[2px] ${
                                psaCurrencyTab === curr
                                  ? 'text-black font-bold border-black'
                                  : 'text-gray-600 hover:text-gray-900 border-transparent'
                              }`}
                            >
                              {curr === 'jpy' ? '¥' : '$'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-gray-100">
                            <tr className="text-gray-600 border-b border-gray-300">
                              <th className="text-right pb-0.5 text-2xs">価格</th>
                              <th className="text-right pb-0.5 text-2xs">日時</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(historyTab === 'psa10'
                              ? detail.psaMetrics.grade10_auction_sales
                              : detail.psaMetrics.grade9_auction_sales
                            )
                              ?.slice(0, 20)
                              .map((sale, i) => {
                                const price = sale.price
                                if (price === null) return null
                                const displayPrice = psaCurrencyTab === 'jpy' && detail.usdJpyRate
                                  ? (price * detail.usdJpyRate).toLocaleString('ja-JP', { maximumFractionDigits: 0 })
                                  : price.toFixed(0)
                                const currencySymbol = psaCurrencyTab === 'jpy' ? '¥' : '$'
                                return (
                                  <tr key={i} className="border-b border-gray-300/30 last:border-0">
                                    <td className="py-0.5 text-right font-medium text-black text-2xs">
                                      {currencySymbol}{displayPrice}
                                    </td>
                                    <td className="py-0.5 text-right text-gray-600 text-2xs">
                                      {new Date(sale.date).toLocaleDateString('ja-JP', {
                                        month: '2-digit',
                                        day: '2-digit',
                                      })}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* スニダンへのリンク */}
            <div className="mt-6">
              <a
                href={`https://snkrdunk.com/apparels/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                スニダンで見る →
              </a>
            </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
