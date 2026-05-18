'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { updateSetCards } from '@/app/actions/psa'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

interface CardDetail {
  psa_spec_id: number
  card_name: string
  card_name_ja: string | null
  card_number: string
  variety: string | null
  total_graded: number
  gem_count_psa10: number
  gem_rate_psa10: number
  image_urls: string[] | null
  psa_psa10_avg_price_3d: number | null
  psa_psa10_qty_3d: number | null
  psa_psa9_avg_price_3d: number | null
  psa_psa9_qty_3d: number | null
  snidan_apparel_id: string | null
  snidan_psa10_avg_price_3d: number | null
  snidan_psa10_qty_3d: number | null
  snidan_psa9_avg_price_3d: number | null
  snidan_psa9_qty_3d: number | null
  snidan_code: string | null
  set: {
    set_name: string
    set_code: string | null
    year: number
    psa_spec_id: number
  }
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
  const [showSetCodeModal, setShowSetCodeModal] = useState(false)
  const [setCodeInput, setSetCodeInput] = useState('')
  const [setCodeLoading, setSetCodeLoading] = useState(false)
  const [setCodeError, setSetCodeError] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null)
  const [cardModalLoading, setCardModalLoading] = useState(false)

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

  const handleUpdateSetCode = async () => {
    if (!set || !setCodeInput.trim()) {
      setSetCodeError('セットコードを入力してください')
      return
    }

    setSetCodeLoading(true)
    setSetCodeError(null)

    try {
      const response = await fetch('/api/sets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psa_spec_id: set.psa_spec_id,
          set_code: setCodeInput,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'セットコードの更新に失敗しました')
      }

      // 成功したら set を更新
      setSet(prev => prev ? { ...prev, set_code: setCodeInput } : null)
      setShowSetCodeModal(false)
      setSetCodeInput('')
    } catch (error) {
      setSetCodeError(error instanceof Error ? error.message : 'セットコードの更新に失敗しました')
    } finally {
      setSetCodeLoading(false)
    }
  }

  const fetchCardDetail = async (specId: number) => {
    // すぐにローディングモーダルを表示
    setSelectedCard({
      psa_spec_id: specId,
      card_name: 'Loading...',
      card_name_ja: null,
      card_number: '',
      variety: null,
      total_graded: 0,
      gem_count_psa10: 0,
      gem_rate_psa10: 0,
      image_urls: null,
      psa_psa10_avg_price_3d: null,
      psa_psa10_qty_3d: null,
      psa_psa9_avg_price_3d: null,
      psa_psa9_qty_3d: null,
      snidan_apparel_id: null,
      snidan_psa10_avg_price_3d: null,
      snidan_psa10_qty_3d: null,
      snidan_psa9_avg_price_3d: null,
      snidan_psa9_qty_3d: null,
      snidan_code: null,
      set: {
        set_name: 'Loading...',
        set_code: null,
        year: 0,
        psa_spec_id: 0,
      },
    })
    setCardModalLoading(true)

    try {
      const response = await fetch(`/api/psa-cards/${specId}`)
      const data = await response.json()
      setSelectedCard(data)
    } catch (error) {
      console.error('Error fetching card detail:', error)
    } finally {
      setCardModalLoading(false)
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
              {set.set_code ? (
                <button
                  onClick={() => {
                    setShowSetCodeModal(true)
                    setSetCodeInput('')
                    setSetCodeError(null)
                  }}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  title="クリックしてセットコードを編集"
                >
                  [{set.set_code}]
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowSetCodeModal(true)
                    setSetCodeInput('')
                    setSetCodeError(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 hover:underline cursor-pointer"
                  title="クリックしてセットコードを編集"
                >
                  [コードなし]
                </button>
              )}
              {' '}{set.set_name}
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
                      <button
                        onClick={() => fetchCardDetail(card.psa_spec_id)}
                        className="text-blue-600 hover:underline text-left"
                      >
                        {card.card_name}
                      </button>
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

      {/* カード詳細モーダル */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-lg md:rounded-lg shadow-lg w-full md:max-w-2xl md:mx-4 max-h-screen overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    {selectedCard.set.year}年 {selectedCard.set.set_code && `[${selectedCard.set.set_code}]`} {selectedCard.set.set_name}
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedCard.card_name}
                    {selectedCard.card_number && <span className="text-gray-600"> #{selectedCard.card_number}</span>}
                    <span className="text-sm font-normal text-gray-500"> ( SPEC_ID : {selectedCard.psa_spec_id} )</span>
                  </h2>
                  {selectedCard.card_name_ja && (
                    <p className="text-lg text-gray-600 mt-2">
                      {selectedCard.card_name_ja}
                      {selectedCard.snidan_code && (
                        <span className="text-sm text-gray-500 ml-2">[{selectedCard.snidan_code}]</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              {selectedCard.image_urls && selectedCard.image_urls.length > 0 && (
                <div className="mb-6">
                  <img
                    src={selectedCard.image_urls[0].startsWith('http')
                      ? selectedCard.image_urls[0]
                      : `https://d1htnxwo4o0jhw.cloudfront.net/spec/${selectedCard.psa_spec_id}/${selectedCard.image_urls[0]}.jpg`
                    }
                    alt={selectedCard.card_name}
                    className="w-full rounded-lg object-contain max-h-96"
                  />
                </div>
              )}

              <div className="space-y-4">
                {selectedCard.variety && (
                  <div>
                    <p className="text-sm text-gray-500">バリエーション</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedCard.variety}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-3">PSA グレーディング統計</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-600 mb-1">GEM率</p>
                      <p className="text-2xl font-bold text-red-600">
                        {selectedCard.gem_rate_psa10.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-600 mb-1">PSA10枚数</p>
                      <p className="text-2xl font-bold text-green-600">
                        {selectedCard.gem_count_psa10.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-600 mb-1">総枚数</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {selectedCard.total_graded.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-3">価格データ（直近3日平均）</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b">
                          <th className="px-2 py-2 text-left">グレード</th>
                          <th className="px-2 py-2 text-right">公式価格</th>
                          <th className="px-2 py-2 text-right">Snidan価格</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-2 font-semibold">PSA10</td>
                          <td className="px-2 py-2 text-right text-red-600 font-semibold">
                            {selectedCard.psa_psa10_avg_price_3d ? `¥${selectedCard.psa_psa10_avg_price_3d.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-900 font-semibold">
                            {selectedCard.snidan_psa10_avg_price_3d ? `¥${selectedCard.snidan_psa10_avg_price_3d.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-2 font-semibold">PSA9</td>
                          <td className="px-2 py-2 text-right text-red-600 font-semibold">
                            {selectedCard.psa_psa9_avg_price_3d ? `¥${selectedCard.psa_psa9_avg_price_3d.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-900 font-semibold">
                            {selectedCard.snidan_psa9_avg_price_3d ? `¥${selectedCard.snidan_psa9_avg_price_3d.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* セットコード編集モーダル */}
      {showSetCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">セットコードを編集</h3>

            {setCodeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {setCodeError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                セットコード
              </label>
              <input
                type="text"
                placeholder="例: sv4pt"
                value={setCodeInput}
                onChange={(e) => setSetCodeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateSetCode()
                  }
                }}
                disabled={setCodeLoading}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSetCodeModal(false)
                  setSetCodeInput('')
                  setSetCodeError(null)
                }}
                disabled={setCodeLoading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleUpdateSetCode}
                disabled={setCodeLoading || !setCodeInput.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {setCodeLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
