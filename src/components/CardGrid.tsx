'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { CardWithTrend } from '@/types'

interface Props {
  cards: CardWithTrend[]
}

export default function CardGrid({ cards }: Props) {
  if (cards.length === 0) {
    return <div className="text-gray-400 text-center py-16">カードが見つかりませんでした</div>
  }

  const extractCardInfo = (name: string) => {
    const cardName = name.split(/[（(]/)[0]?.trim() || name
    const setName = name.match(/[（(]([^）)]+)[）)]/)?.[1] || ''
    return { cardName, setName }
  }

  return (
    <>
      {/* スマホ版：リスト表示 */}
      <div className="sm:hidden space-y-3">
        {cards.map((card) => {
          const { cardName, setName } = extractCardInfo(card.localizedName || card.name)
          return (
            <Link
              key={card.id}
              href={`/cards/${card.id}`}
              className="flex items-start gap-3 bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* 画像 */}
              <div className="flex-shrink-0 w-20 h-28 bg-gray-100">
                {card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt={cardName}
                    width={80}
                    height={112}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                )}
              </div>

              {/* データ */}
              <div className="flex-1 p-3 text-[10px] flex flex-col">
                {/* カード名・セット名 */}
                <div className="mb-2">
                  <p className="font-medium line-clamp-1">
                    {cardName}
                  </p>
                  {setName && (
                    <p className="text-gray-600 text-[8px] line-clamp-1">
                      {setName}
                    </p>
                  )}
                </div>

                {/* 4要素 */}
                <div className="flex justify-between gap-2">
                  {/* PSA10 */}
                  <div className="flex-1 text-center">
                    <p className="text-gray-600 text-xs">PSA10</p>
                    <p className="font-bold text-red-600 text-xs">
                      {card.avgPricePsa10 !== null ? `¥${card.avgPricePsa10.toLocaleString()}` : '―'}
                    </p>
                  </div>

                  {/* PSA9 */}
                  <div className="flex-1 text-center">
                    <p className="text-gray-600 text-xs">PSA9</p>
                    <p className="font-bold text-xs">
                      {card.avgPricePsa9 !== null ? `¥${card.avgPricePsa9.toLocaleString()}` : '―'}
                    </p>
                  </div>

                  {/* 差額 */}
                  <div className="flex-1 text-center">
                    <p className="text-gray-600 text-xs">差額</p>
                    <p className="font-bold text-blue-600 text-xs">
                      {card.priceDiff !== null ? `¥${card.priceDiff.toLocaleString()}` : '―'}
                    </p>
                  </div>

                  {/* 販売数 */}
                  <div className="flex-1 text-center">
                    <p className="text-gray-600 text-xs">販売数</p>
                    <p className="font-bold">
                      <span className="text-red-600">{card.salesCount3dPsa10}</span>
                      <span className="text-gray-500 mx-0.5">/</span>
                      <span>{card.salesCount3dPsa9}</span>
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* PC版：グリッド表示 */}
      <div className="hidden sm:grid grid-cols-5 gap-4">
        {cards.map((card) => {
          const { cardName, setName } = extractCardInfo(card.localizedName || card.name)
          return (
            <Link
              key={card.id}
              href={`/cards/${card.id}`}
              className="bg-white border border-gray-300 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-[3/4] bg-gray-100">
                {card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt={cardName}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-sm">No Image</div>
                )}
              </div>

              <div className="p-3 space-y-2 text-[10px]">
                <div>
                  <p className="text-black font-medium leading-tight line-clamp-1">
                    {cardName}
                  </p>
                  {setName && (
                    <p className="text-gray-600 leading-tight line-clamp-1 text-[8px]">
                      {setName}
                    </p>
                  )}
                </div>

                {/* 直近3日平均価格 */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600">PSA10 avg</p>
                    <p className="text-red-600 font-bold">
                      {card.avgPricePsa10 !== null ? `¥${card.avgPricePsa10.toLocaleString()}` : '―'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">PSA9 avg</p>
                    <p className="text-black">
                      {card.avgPricePsa9 !== null ? `¥${card.avgPricePsa9.toLocaleString()}` : '―'}
                    </p>
                  </div>
                </div>

                {/* 差額 */}
                {card.priceDiff !== null && (
                  <p className="text-gray-600">
                    PSA10-9差額: <span className="text-black">¥{card.priceDiff.toLocaleString()}</span>
                  </p>
                )}

                {/* 直近3日販売数 */}
                <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                  <span className="text-gray-600">直近3日の販売数</span>
                  <span>
                    <span className="text-red-600 font-medium">{card.salesCount3dPsa10}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-black">{card.salesCount3dPsa9}</span>
                    <span className="text-gray-500 ml-1">PSA10/9</span>
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
