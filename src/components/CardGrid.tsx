'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { CardWithTrend } from '@/types'

interface Props {
  cards: CardWithTrend[]
}

function TrendBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-gray-500 text-xs">データなし</span>
  const isUp = percent > 0
  const color = isUp ? 'text-green-400' : percent < 0 ? 'text-red-400' : 'text-gray-400'
  const arrow = isUp ? '▲' : percent < 0 ? '▼' : '―'
  return (
    <span className={`text-sm font-bold ${color}`}>
      {arrow} {Math.abs(percent).toFixed(1)}%
    </span>
  )
}

export default function CardGrid({ cards }: Props) {
  if (cards.length === 0) {
    return <div className="text-gray-400 text-center py-16">カードが見つかりませんでした</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Link
          key={card.id}
          href={`/cards/${card.id}`}
          className="bg-gray-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all"
        >
          <div className="relative aspect-[3/4] bg-gray-900">
            {card.imageUrl ? (
              <Image
                src={card.imageUrl}
                alt={card.localizedName || card.name}
                fill
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">No Image</div>
            )}
          </div>

          <div className="p-3 space-y-2">
            <p className="text-white text-sm font-medium leading-tight line-clamp-2">
              {card.localizedName || card.name}
            </p>

            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400">PSA10</p>
                <p className="text-amber-400 font-bold text-sm">
                  {card.currentPricePsa10 !== null
                    ? `¥${card.currentPricePsa10.toLocaleString()}`
                    : '―'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">PSA9</p>
                <p className="text-gray-300 text-sm">
                  {card.currentPricePsa9 !== null
                    ? `¥${card.currentPricePsa9.toLocaleString()}`
                    : '―'}
                </p>
              </div>
            </div>

            {card.priceDiff !== null && (
              <p className="text-xs text-gray-400">
                10-9差: <span className="text-white">¥{card.priceDiff.toLocaleString()}</span>
              </p>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-gray-700">
              <span className="text-xs text-gray-400">1ヶ月トレンド</span>
              <TrendBadge percent={card.trendPercent} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
