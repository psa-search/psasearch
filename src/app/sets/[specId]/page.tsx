'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { updateSetCards } from '@/app/actions/psa'

interface SetData {
  psa_spec_id: number
  set_name: string
  set_code: string | null
  year: number
}

interface Card {
  psa_spec_id: number
  card_name: string
  card_number: string
  variety: string | null
  gem_rate_psa10: number
}

interface Props {
  params: Promise<{ specId: string }>
}

export default function SetDetailPage({ params: paramsPromise }: Props) {
  const [specId, setSpecId] = useState<string | null>(null)
  const [set, setSet] = useState<SetData | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  useEffect(() => {
    const resolveParams = async () => {
      const params = await paramsPromise
      setSpecId(params.specId)
    }
    resolveParams()
  }, [paramsPromise])

  useEffect(() => {
    if (!specId) return

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/sets/${specId}`)
        if (!response.ok) {
          console.error('API error:', response.status)
          setLoading(false)
          return
        }
        const data = await response.json()
        setSet(data.set)
        setCards(data.cards)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [specId])

  const handleUpdate = async () => {
    if (!set) return

    setUpdating(true)
    setUpdateMessage('更新中...')

    try {
      const result = await updateSetCards(set.psa_spec_id, set.set_name)

      if (result.success) {
        setUpdateMessage(`✓ ${result.message}`)
        // リロードしてデータを更新
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setUpdateMessage(`✗ ${result.message}`)
      }
    } catch (error) {
      setUpdateMessage(`✗ エラーが発生しました`)
    } finally {
      setUpdating(false)
    }
  }

  const sortedCards = [...cards].sort((a, b) => {
    // カード番号がない場合は先頭
    if (!a.card_number) return -1
    if (!b.card_number) return 1

    // カード番号を数値でソート
    const aNum = parseInt(a.card_number) || 0
    const bNum = parseInt(b.card_number) || 0
    return aNum - bNum
  })

  const getPSACardURL = () => {
    if (!set) return ''
    const slug = set.set_name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    return `https://www.psacard.com/pop/tcg-cards/${set.year}/pokemon-japanese-${slug}/${set.psa_spec_id}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    )
  }

  if (!set) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">セットが見つかりません</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Link
          href="/sets"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8"
        >
          ← セット一覧に戻る
        </Link>

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {set.set_code && <span className="text-blue-600">[{set.set_code}] </span>}
              {set.set_name}
            </h1>
            <div className="flex items-center gap-6 text-lg text-gray-600">
              <span>{set.year}年</span>
              <span>{cards.length}カード</span>
              <a
                href={getPSACardURL()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                PSA公式で見る →
              </a>
            </div>
          </div>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
          >
            {updating ? '更新中...' : '更新'}
          </button>
        </div>

        {updateMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900">{updateMessage}</p>
          </div>
        )}

        {cards.length > 0 && (
          <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">カード番号</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">カード名</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">バリエーション</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">GEM率</th>
                </tr>
              </thead>
              <tbody>
                {sortedCards.map((card, idx) => (
                  <tr key={card.psa_spec_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {card.card_number ? `#${card.card_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <Link
                        href={`/psa-cards/${card.psa_spec_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {card.card_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {card.variety || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={card.gem_rate_psa10 >= 50 ? 'font-semibold text-green-600' : 'text-gray-700'}>
                        {card.gem_rate_psa10.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600">取得済みカードがありません</p>
            <p className="text-sm text-gray-500 mt-2">「更新」ボタンでデータを取得してください</p>
          </div>
        )}
      </div>
    </div>
  )
}
