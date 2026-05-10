'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PriceChart from '@/components/PriceChart'
import type { PricePoint, SalesRecord } from '@/types'

interface CardDetail {
  apparelId: number
  chartPsa10All: PricePoint[]
  chartPsa9All: PricePoint[]
  chartPsa10Month: PricePoint[]
  chartPsa9Month: PricePoint[]
  chartPsa10ThreeMonths: PricePoint[]
  chartPsa9ThreeMonths: PricePoint[]
  hasThreeMonths: boolean
  salesHistory: SalesRecord[]
}

type Range = 'week' | 'month' | 'threeMonths' | 'all'

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'month', label: '1ヶ月' },
  { key: 'threeMonths', label: '3ヶ月' },
  { key: 'all', label: '全期間' },
]

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<CardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('month')

  useEffect(() => {
    fetch(`/api/cards/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const getPsa10 = (r: Range): PricePoint[] => {
    if (!detail) return []
    switch (r) {
      case 'month': return detail.chartPsa10Month
      case 'threeMonths': return detail.chartPsa10ThreeMonths
      case 'all': return detail.chartPsa10All
      default: return detail.chartPsa10Month
    }
  }

  const getPsa9 = (r: Range): PricePoint[] => {
    if (!detail) return []
    switch (r) {
      case 'month': return detail.chartPsa9Month
      case 'threeMonths': return detail.chartPsa9ThreeMonths
      case 'all': return detail.chartPsa9All
      default: return detail.chartPsa9Month
    }
  }

  const psa10 = getPsa10(range)
  const psa9 = getPsa9(range)

  // 最新価格は全期間データの末尾から取る
  const latestPsa10 = detail?.chartPsa10All.at(-1)?.price ?? null
  const latestPsa9 = detail?.chartPsa9All.at(-1)?.price ?? null

  // 表示可能なrangeオプション（3ヶ月はhasThreeMonthsがtrueの場合のみ）
  const visibleOptions = RANGE_OPTIONS.filter(
    (o) => o.key !== 'threeMonths' || detail?.hasThreeMonths
  )

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <a href="/" className="text-gray-400 hover:text-white text-sm mb-6 inline-block">
          ← 一覧に戻る
        </a>

        <h1 className="text-xl font-bold mb-6 text-amber-400">カード詳細 #{id}</h1>

        {loading && <p className="text-gray-400">読み込み中...</p>}

        {detail && (
          <>
            {/* 価格サマリー */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">PSA10 直近価格</p>
                <p className="text-xl font-bold text-amber-400">
                  {latestPsa10 ? `¥${latestPsa10.toLocaleString()}` : '―'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">PSA9 直近価格</p>
                <p className="text-xl font-bold text-gray-300">
                  {latestPsa9 ? `¥${latestPsa9.toLocaleString()}` : '―'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">PSA10-9 価格差</p>
                <p className="text-xl font-bold text-blue-400">
                  {latestPsa10 !== null && latestPsa9 !== null
                    ? `¥${(latestPsa10 - latestPsa9).toLocaleString()}`
                    : '―'}
                </p>
              </div>
            </div>

            {/* 期間切り替え */}
            <div className="flex gap-2 mb-4">
              {visibleOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`px-3 py-1 rounded text-sm ${
                    range === key
                      ? 'bg-amber-500 text-black font-medium'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 価格チャート */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-gray-300 mb-4">価格推移（スニダン）</h2>
              <PriceChart psa10={psa10} psa9={psa9} height={350} />
            </div>

            {/* 販売履歴 */}
            {detail.salesHistory.length > 0 && (
              <div className="mt-6 bg-gray-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-300 mb-3">販売履歴</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs border-b border-gray-700">
                        <th className="text-left pb-2">グレード</th>
                        <th className="text-right pb-2">価格</th>
                        <th className="text-right pb-2">日時</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.salesHistory.map((record, i) => (
                        <tr key={i} className="border-b border-gray-700/50 last:border-0">
                          <td className="py-2">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              record.condition === 'PSA10'
                                ? 'bg-amber-500/20 text-amber-400'
                                : record.condition === 'PSA9'
                                ? 'bg-gray-600 text-gray-300'
                                : 'bg-gray-700 text-gray-400'
                            }`}>
                              {record.condition}
                            </span>
                          </td>
                          <td className="py-2 text-right font-medium">
                            ¥{record.price.toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-gray-400 text-xs">
                            {record.date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* スニダンへのリンク */}
            <div className="mt-6">
              <a
                href={`https://snkrdunk.com/apparels/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline text-sm"
              >
                スニダンで見る →
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
