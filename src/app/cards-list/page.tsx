'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Card {
  psa_spec_id: number
  set_id: number
  card_number: string
  card_name: string
  card_name_ja: string | null
  variety: string | null
  total_graded: number
  gem_count_psa10: number
  gem_rate_psa10: number
  image_urls: string[] | null
  psa_psa10_avg_price_3d: number | null
  psa_psa10_qty_3d: number | null
  psa_psa9_avg_price_3d: number | null
  psa_psa9_qty_3d: number | null
  priceDiffRatio: number | null
  snidan_apparel_id: string | null
  snidan_psa10_avg_price_3d: number | null
  snidan_psa10_qty_3d: number | null
  snidan_psa9_avg_price_3d: number | null
  snidan_psa9_qty_3d: number | null
  snidan_code: string | null
  set: {
    set_code: string | null
  }
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
  snidan_psa10_qty_3d?: number | null
  snidan_psa9_avg_price_3d: number | null
  snidan_psa9_qty_3d?: number | null
  snidan_code: string | null
  set: {
    set_name: string
    set_code: string | null
    year: number
    psa_spec_id: number
  }
}

export default function CardsListPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('gem_rate_psa10')
  const [order, setOrder] = useState('desc')
  const [limit, setLimit] = useState('100')
  const [minGem10, setMinGem10] = useState('')
  const [minTotal, setMinTotal] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceProgress, setPriceProgress] = useState(0)
  const [showSnidanUrlModal, setShowSnidanUrlModal] = useState(false)
  const [snidanUrl, setSnidanUrl] = useState('')
  const [snidanModalLoading, setSnidanModalLoading] = useState(false)
  const [modalPriceLoading, setModalPriceLoading] = useState(false)
  const [modalPriceError, setModalPriceError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<Array<{ date: string; psa10Official?: number | null; psa9Official?: number | null; psa10Snidan?: number | null; psa9Snidan?: number | null }> | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartPeriod, setChartPeriod] = useState<'1month' | '3months'>('3months')
  const [psaSalesHistory, setPsaSalesHistory] = useState<Array<{ saleDate?: string; priceJpy: number; saleTypeLabel?: string; listingURL?: string | null }>>([])
  const [snidanSalesHistory, setSnidanSalesHistory] = useState<Array<{ soldAt?: string; priceJpy: number }>>([])
  const [salesGrade, setSalesGrade] = useState<10 | 9>(10)
  const [salesLoading, setSalesLoading] = useState(false)
  const [showCertNumberModal, setShowCertNumberModal] = useState(false)
  const [certNumberInput, setCertNumberInput] = useState('')
  const [certNumberLoading, setCertNumberLoading] = useState(false)
  const [certNumberError, setCertNumberError] = useState<string | null>(null)

  const searchByCertNumber = async () => {
    if (!certNumberInput.trim()) {
      setCertNumberError('鑑定番号を入力してください')
      return
    }

    setCertNumberLoading(true)
    setCertNumberError(null)
    try {
      const response = await fetch(`/api/search-by-cert-number?certNumber=${encodeURIComponent(certNumberInput)}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        setCertNumberError(data.error || '検索に失敗しました')
        return
      }

      // spec ID を検索ワードに設定
      const specId = data.specId
      setSearch(specId.toString())
      setCurrentPage(1)
      setShowCertNumberModal(false)
      setCertNumberInput('')

      // 自動検索を実行
      setTimeout(() => {
        fetchCards(1)
      }, 0)
    } catch (error) {
      setCertNumberError((error as Error).message || '検索エラー')
    } finally {
      setCertNumberLoading(false)
    }
  }

  const fetchCards = async (page: number) => {
    setLoading(true)
    try {
      // 複合検索: "SV6 064" を分割して検索
      const searchTerms = search.trim().split(/\s+/).filter(t => t.length > 0)

      // API からデータを取得
      let params: URLSearchParams
      if (searchTerms.length === 0) {
        params = new URLSearchParams({ sortBy, order, limit })
      } else {
        params = new URLSearchParams({ sortBy, order, limit })
        // 複数キーワードをすべて送る
        searchTerms.forEach(term => {
          params.append('search', term)
        })
      }

      if (minGem10) params.append('minGem10', minGem10)
      if (minTotal) params.append('minTotal', minTotal)

      // Add offset for pagination
      const offset = (page - 1) * parseInt(limit)
      params.append('offset', offset.toString())

      console.log('[Cards] Fetching with params:', params.toString())
      const response = await fetch(`/api/cards?${params}`)

      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`)
        const errorText = await response.text()
        console.error('Response:', errorText)
        setCards([])
        setTotalCount(0)
        return
      }

      const data = await response.json()
      console.log('[Cards] Response:', data)

      if (data.error) {
        console.error('API error:', data.error)
        setCards([])
        setTotalCount(0)
        return
      }

      const cards = Array.isArray(data) ? data : data.cards || []
      const total = data.total || cards.length

      setCards(cards)
      setTotalCount(total)
    } catch (error) {
      console.error('Error fetching cards:', error)
      setCards([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // ページ変更時にデータ取得
  useEffect(() => {
    if (hasSearched) {
      fetchCards(currentPage)
    }
  }, [currentPage, hasSearched]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setOrder(order === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(newSortBy)
      setOrder('desc')
    }
  }

  const fetchCardDetail = async (specId: number) => {
    setModalLoading(true)
    try {
      const response = await fetch(`/api/psa-cards/${specId}`)
      const data = await response.json()
      setSelectedCard(data)

      // Reset all states
      setSalesGrade(10)
      setPsaSalesHistory([])
      setSnidanSalesHistory([])
      setChartData(null)
      setChartPeriod('3months')

      // Fetch sales history and chart data for both sources (PSA10 by default)
      setSalesLoading(true)
      setChartLoading(true)
      console.log('[CardDetail] Fetching sales and chart for specId:', specId, 'snidanId:', data.snidan_apparel_id)

      const promises: Promise<void>[] = [
        fetchSalesHistory(specId, 'psa', 10),
        fetchChartData(specId, '3months')
      ]
      if (data.snidan_apparel_id) {
        promises.push(fetchSalesHistory(specId, 'snidan', 10, data.snidan_apparel_id))
      }
      await Promise.all(promises)
      setSalesLoading(false)
      setChartLoading(false)
    } catch (error) {
      console.error('Error fetching card detail:', error)
    } finally {
      setModalLoading(false)
    }
  }

  const fetchChartData = async (specId: number, period: '1month' | '3months' = '3months') => {
    setChartLoading(true)
    try {
      const snidanId = selectedCard?.snidan_apparel_id
      const params = new URLSearchParams({ period })
      if (snidanId) {
        params.append('snidanId', snidanId)
      }
      const url = `/api/psa-cards/${specId}/chart?${params}`
      console.log('[Chart] URL:', url)
      const response = await fetch(url)
      const data = await response.json()
      console.log('[Chart] Response:', data)
      setChartData(data.data || [])
    } catch (error) {
      console.error('Error fetching chart:', error)
      setChartData([])
    } finally {
      setChartLoading(false)
    }
  }

  const fetchSalesHistory = async (specId: number, source: 'psa' | 'snidan', grade: 10 | 9, snidanId?: string) => {
    try {
      const params = new URLSearchParams({ source, g: grade.toString() })
      if (source === 'snidan' && snidanId) {
        params.append('snidanId', snidanId)
      }
      const url = `/api/psa-cards/${specId}/sales?${params}`
      console.log('[Sales] Fetching from:', url)
      const response = await fetch(url)
      const data = await response.json()
      console.log('[Sales] Response:', data)

      if (source === 'psa') {
        setPsaSalesHistory(data.sales || [])
      } else {
        setSnidanSalesHistory(data.sales || [])
      }
    } catch (error) {
      console.error('Error fetching sales history:', error)
      if (source === 'psa') {
        setPsaSalesHistory([])
      } else {
        setSnidanSalesHistory([])
      }
    }
  }

  const saveSnidanUrl = async () => {
    if (!selectedCard || !snidanUrl.trim()) return

    setSnidanModalLoading(true)
    try {
      const response = await fetch('/api/snidan/save-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specId: selectedCard.psa_spec_id,
          url: snidanUrl,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update selected card with new data
        setSelectedCard(prev => prev ? {
          ...prev,
          snidan_apparel_id: result.snidan_apparel_id,
          snidan_psa10_avg_price_3d: result.snidan_psa10_avg_price_3d,
          snidan_psa9_avg_price_3d: result.snidan_psa9_avg_price_3d,
          card_name_ja: result.card_name_ja || prev.card_name_ja,
          image_urls: result.image_urls || prev.image_urls,
        } : null)

        // Update card in list
        setCards(prev => prev.map(card =>
          card.psa_spec_id === selectedCard.psa_spec_id
            ? {
                ...card,
                snidan_apparel_id: result.snidan_apparel_id,
                snidan_psa10_avg_price_3d: result.snidan_psa10_avg_price_3d,
                snidan_psa9_avg_price_3d: result.snidan_psa9_avg_price_3d,
                card_name_ja: result.card_name_ja || card.card_name_ja,
                image_urls: result.image_urls || card.image_urls,
              }
            : card
        ))

        setShowSnidanUrlModal(false)
        setSnidanUrl('')
      } else {
        alert('エラー: ' + (result.error || '不明なエラー'))
      }
    } catch (error) {
      console.error('Error saving Snidan URL:', error)
      alert('エラー: Snidan URLの保存に失敗しました')
    } finally {
      setSnidanModalLoading(false)
    }
  }

  const deleteSnidanLink = async () => {
    if (!selectedCard) return

    if (!confirm('スニダンのリンクを解除してもよろしいですか？\n関連するデータ（価格、コード）もすべて削除されます。')) {
      return
    }

    setSnidanModalLoading(true)
    try {
      const response = await fetch('/api/snidan/delete-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specId: selectedCard.psa_spec_id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update selected card with cleared snidan data
        setSelectedCard(prev => prev ? {
          ...prev,
          snidan_apparel_id: null,
          snidan_psa10_avg_price_3d: null,
          snidan_psa9_avg_price_3d: null,
          snidan_code: null,
        } : null)

        // Update card in list
        setCards(prev => prev.map(card =>
          card.psa_spec_id === selectedCard.psa_spec_id
            ? {
                ...card,
                snidan_apparel_id: null,
                snidan_psa10_avg_price_3d: null,
                snidan_psa9_avg_price_3d: null,
                snidan_code: null,
              }
            : card
        ))

        setShowSnidanUrlModal(false)
        setSnidanUrl('')
        alert('スニダンのリンクを削除しました')
      } else {
        alert('エラー: ' + (result.error || '不明なエラー'))
      }
    } catch (error) {
      console.error('Error deleting Snidan link:', error)
      alert('エラー: スニダンリンクの削除に失敗しました')
    } finally {
      setSnidanModalLoading(false)
    }
  }

  const fetchPriceForSelectedCard = async () => {
    if (!selectedCard) return

    setModalPriceLoading(true)
    setModalPriceError(null)

    try {
      console.log('[Client] Fetching price for specId:', selectedCard.psa_spec_id)
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specIds: [selectedCard.psa_spec_id] }),
      })

      console.log('[Client] Response status:', response.status)
      const result = await response.json()
      console.log('[Client] Response data:', result)

      if (!response.ok || !result.success) {
        throw new Error(result.error || '価格取得に失敗しました')
      }

      console.log('[Client] Update results:', result.results)
      // Refresh card detail to show updated prices and quantities
      if (result.results && result.results.length > 0) {
        const updated = result.results[0]

        // Update card in list
        setCards(prev => prev.map(card =>
          card.psa_spec_id === selectedCard.psa_spec_id
            ? {
                ...card,
                psa_psa10_avg_price_3d: updated.psa_psa10_avg_price_3d,
                psa_psa9_avg_price_3d: updated.psa_psa9_avg_price_3d,
                snidan_apparel_id: updated.snidan_apparel_id,
                snidan_psa10_avg_price_3d: updated.snidan_psa10_avg_price_3d,
                snidan_psa9_avg_price_3d: updated.snidan_psa9_avg_price_3d,
              }
            : card
        ))

        // Refresh card detail to show updated prices and quantities
        await fetchCardDetail(selectedCard.psa_spec_id)
        console.log('[Client] Card updated with prices')
      } else {
        console.log('[Client] No results returned')
      }
    } catch (error) {
      setModalPriceError(error instanceof Error ? error.message : '価格取得に失敗しました')
      console.error('[Client] Error fetching price:', error)
    } finally {
      setModalPriceLoading(false)
    }
  }

  const fetchImagesForAll = async () => {
    if (cards.length === 0) return

    setBatchLoading(true)
    setBatchProgress(0)

    // 現在のページに表示されているカードだけを取得
    const pageSize = parseInt(limit)
    const startIdx = (currentPage - 1) * pageSize
    const endIdx = Math.min(startIdx + pageSize, cards.length)
    const pageCards = cards.slice(startIdx, endIdx)

    if (pageCards.length === 0) return

    // 並列処理数を制限（一度に5件まで）
    const batchSize = 5
    let completed = 0
    let successCount = 0

    for (let i = 0; i < pageCards.length; i += batchSize) {
      const batch = pageCards.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async card => {
          try {
            const response = await fetch(`/api/psa-cards/${card.psa_spec_id}`)
            const data = await response.json()
            console.log(`${card.psa_spec_id}: image_urls =`, data.image_urls)
            if (data.image_urls && data.image_urls.length > 0) {
              successCount++
            }
            return data
          } catch (err) {
            console.error(`Failed to fetch ${card.psa_spec_id}:`, err)
            return null
          }
        })
      )
      completed += batch.length
      setBatchProgress(Math.min(completed, pageCards.length))
    }

    console.log(`取得完了: ${successCount}/${pageCards.length} 件に画像あり (ページ${currentPage})`)

    // 取得完了後、データをリロード
    await fetchCards(currentPage)
    setBatchLoading(false)
    setBatchProgress(0)
  }

  const fetchPricesForAll = async () => {
    if (cards.length === 0) return

    setPriceLoading(true)
    setPriceProgress(0)

    // 現在のページに表示されているカードだけを取得
    const pageSize = parseInt(limit)
    const startIdx = (currentPage - 1) * pageSize
    const endIdx = Math.min(startIdx + pageSize, cards.length)
    const pageCards = cards.slice(startIdx, endIdx)

    if (pageCards.length === 0) return

    const batchSize = 5
    let completed = 0
    const updatedCardData = new Map<number, any>() // specId -> updated card data

    for (let i = 0; i < pageCards.length; i += batchSize) {
      const batch = pageCards.slice(i, i + batchSize)
      const specIds = batch.map(card => card.psa_spec_id)

      try {
        const response = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specIds }),
        })
        const data = await response.json()

        // Store updated card data
        if (data.results) {
          for (const result of data.results) {
            const cardIdx = cards.findIndex(c => c.psa_spec_id === result.specId)
            if (cardIdx >= 0) {
              const originalCard = cards[cardIdx]
              const updatedCard = {
                ...originalCard,
                psa_psa10_avg_price_3d: result.psa_psa10_avg_price_3d,
                psa_psa9_avg_price_3d: result.psa_psa9_avg_price_3d,
                snidan_apparel_id: result.snidan_apparel_id,
                snidan_psa10_avg_price_3d: result.snidan_psa10_avg_price_3d,
                snidan_psa9_avg_price_3d: result.snidan_psa9_avg_price_3d,
                snidan_code: result.snidan_code,
              }
              updatedCardData.set(result.specId, updatedCard)

              // If snidan_apparel_id was newly discovered, fetch Japanese name
              if (result.snidan_apparel_id && !originalCard.snidan_apparel_id) {
                try {
                  const nameResponse = await fetch('/api/snidan/fetch-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      apparelId: result.snidan_apparel_id,
                      specId: result.specId
                    }),
                  })
                  const nameData = await nameResponse.json()
                  if (nameData.card_name_ja) {
                    updatedCard.card_name_ja = nameData.card_name_ja
                  }
                } catch (err) {
                  console.error('Failed to fetch Snidan name:', err)
                }
              }
            }
          }
        }

        console.log(`価格取得完了: ${data.successCount}/${data.total} (ページ${currentPage})`)
      } catch (err) {
        console.error('Failed to fetch prices:', err)
      }

      completed += batch.length
      setPriceProgress(Math.min(completed, pageCards.length))
    }

    // Update cards locally without reloading
    if (updatedCardData.size > 0) {
      const updatedCards = cards.map(card =>
        updatedCardData.has(card.psa_spec_id) ? updatedCardData.get(card.psa_spec_id) : card
      )
      setCards(updatedCards)
    }

    setPriceLoading(false)
    setPriceProgress(0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">カード一覧</h1>

          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">検索</label>
                <input
                  type="text"
                  placeholder="セット名、カード番号、またはカード名（例: SV6 064）"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ソート順</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gem_rate_psa10">GEM率</option>
                  <option value="total_graded">グレード総数</option>
                  <option value="gem_count_psa10">GEM10枚数</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GEM10枚数 以上</label>
                <input
                  type="number"
                  placeholder="指定なし"
                  value={minGem10}
                  onChange={(e) => {
                    setMinGem10(e.target.value)
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">グレード総数 以上</label>
                <input
                  type="number"
                  placeholder="指定なし"
                  value={minTotal}
                  onChange={(e) => {
                    setMinTotal(e.target.value)
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">表示件数</label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="50">50件</option>
                  <option value="100">100件</option>
                  <option value="500">500件</option>
                  <option value="1000">1000件</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setCurrentPage(1)
                    setHasSearched(true)
                    // 直接フェッチを実行（currentPageが既に1の場合、useEffectが発火しないため）
                    setTimeout(() => fetchCards(1), 0)
                  }}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
                >
                  検索
                </button>
              </div>
            </div>
          </div>

          {loading && <p className="text-center text-gray-600">読み込み中...</p>}

          {batchLoading && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-900 mb-2">画像取得中...</p>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(batchProgress / cards.length) * 100}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 mt-2">{batchProgress} / {cards.length}</p>
            </div>
          )}

          {priceLoading && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-900 mb-2">価格データ取得中...</p>
              <div className="w-full bg-amber-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(priceProgress / cards.length) * 100}%` }}
                />
              </div>
              <p className="text-sm text-amber-700 mt-2">{priceProgress} / {cards.length}</p>
            </div>
          )}

          {!loading && cards.length > 0 && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={fetchImagesForAll}
                disabled={batchLoading || priceLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {batchLoading ? '取得中...' : '画像を一括取得'}
              </button>
              <button
                onClick={fetchPricesForAll}
                disabled={priceLoading || batchLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 transition-colors"
              >
                {priceLoading ? '取得中...' : '価格を取得'}
              </button>
              <button
                onClick={() => setShowCertNumberModal(true)}
                disabled={certNumberLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {certNumberLoading ? '検索中...' : '鑑定番号で検索'}
              </button>
            </div>
          )}

          {!loading && cards.length > 0 && (
            <>
            <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">画像</th>
                    <th
                      onClick={() => toggleSort('card_number')}
                      className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-200"
                    >
                      セット/No {sortBy === 'card_number' && (order === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">カード名</th>
                    <th colSpan={2} className="px-4 py-3 text-center font-semibold text-gray-900 border-l border-gray-300 bg-blue-50">GEM</th>
                    <th colSpan={3} className="px-4 py-3 text-center font-semibold text-gray-900 border-l border-gray-300 bg-green-50">公式価格</th>
                    <th colSpan={3} className="px-4 py-3 text-center font-semibold text-gray-900 border-l border-gray-300 bg-orange-50">Snidan価格</th>
                  </tr>
                  <tr className="bg-gray-50 border-b">
                    <th colSpan={3}></th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 border-l border-gray-300 bg-blue-50">GEM率</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 bg-blue-50">枚数</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 border-l border-gray-300 bg-green-50">PSA10</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 bg-green-50">PSA9</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 bg-green-50">利益率</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 border-l border-gray-300 bg-orange-50">PSA10</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 bg-orange-50">PSA9</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 bg-orange-50">利益率</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card, idx) => {
                    const psaPriceDiff = card.psa_psa10_avg_price_3d && card.psa_psa9_avg_price_3d
                      ? card.psa_psa10_avg_price_3d - card.psa_psa9_avg_price_3d
                      : null

                    const psaPriceDiffPercent = card.psa_psa10_avg_price_3d && card.psa_psa9_avg_price_3d && card.psa_psa9_avg_price_3d > 0
                      ? Math.round((card.psa_psa10_avg_price_3d / card.psa_psa9_avg_price_3d) * 100) - 100
                      : null

                    const snidanPriceDiff = card.snidan_psa10_avg_price_3d && card.snidan_psa9_avg_price_3d
                      ? card.snidan_psa10_avg_price_3d - card.snidan_psa9_avg_price_3d
                      : null

                    const snidanPriceDiffPercent = card.snidan_psa10_avg_price_3d && card.snidan_psa9_avg_price_3d && card.snidan_psa9_avg_price_3d > 0
                      ? Math.round((card.snidan_psa10_avg_price_3d / card.snidan_psa9_avg_price_3d) * 100) - 100
                      : null

                    return (
                      <tr key={card.psa_spec_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3">
                          {card.image_urls && card.image_urls.length > 0 ? (
                            <img
                              src={card.image_urls[0].startsWith('http')
                                ? card.image_urls[0]
                                : `https://d1htnxwo4o0jhw.cloudfront.net/spec/${card.psa_spec_id}/${card.image_urls[0]}.jpg`
                              }
                              alt={card.card_name}
                              className="h-16 w-12 object-cover rounded"
                            />
                          ) : (
                            <div className="h-16 w-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                              {card.image_urls === null ? 'null' : 'empty'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div>{card.set.set_code || '—'}</div>
                          <div>{card.card_number}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <button
                            onClick={() => fetchCardDetail(card.psa_spec_id)}
                            className="text-red-600 hover:underline text-left block"
                          >
                            <div className="font-medium">{card.card_name}</div>
                            {card.card_name_ja && (
                              <div className="text-sm text-gray-600">{card.card_name_ja}</div>
                            )}
                          </button>
                        </td>
                        {/* GEM */}
                        <td className="px-4 py-3 text-right border-l border-gray-300">
                          <span className={card.gem_rate_psa10 >= 50 ? 'font-semibold text-green-600' : 'text-gray-700'}>
                            {card.gem_rate_psa10.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          <div>{card.gem_count_psa10}</div>
                          <div className="text-xs text-gray-500">{card.total_graded}</div>
                        </td>
                        {/* 公式価格 */}
                        <td className="px-4 py-3 text-right border-l border-gray-300 text-gray-700">
                          <div>{card.psa_psa10_avg_price_3d ? `¥${card.psa_psa10_avg_price_3d.toLocaleString()}` : '—'}</div>
                          <div className="text-xs text-gray-500">{card.psa_psa10_qty_3d || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          <div>{card.psa_psa9_avg_price_3d ? `¥${card.psa_psa9_avg_price_3d.toLocaleString()}` : '—'}</div>
                          <div className="text-xs text-gray-500">{card.psa_psa9_qty_3d || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          <div>{psaPriceDiff ? `¥${psaPriceDiff.toLocaleString()}` : '—'}</div>
                          <div className="text-xs text-gray-500">{psaPriceDiffPercent !== null ? `${psaPriceDiffPercent}%` : '—'}</div>
                        </td>
                        {/* Snidan価格 */}
                        <td className="px-4 py-3 text-right border-l border-gray-300 text-gray-700">
                          <div>{card.snidan_psa10_avg_price_3d ? `¥${card.snidan_psa10_avg_price_3d.toLocaleString()}` : '—'}</div>
                          <div className="text-xs text-gray-500">{card.snidan_psa10_qty_3d || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          <div>{card.snidan_psa9_avg_price_3d ? `¥${card.snidan_psa9_avg_price_3d.toLocaleString()}` : '—'}</div>
                          <div className="text-xs text-gray-500">{card.snidan_psa9_qty_3d || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          <div>{snidanPriceDiff ? `¥${snidanPriceDiff.toLocaleString()}` : '—'}</div>
                          <div className="text-xs text-gray-500">{snidanPriceDiffPercent !== null ? `${snidanPriceDiffPercent}%` : '—'}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {totalCount > parseInt(limit) && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  前へ
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.ceil(totalCount / parseInt(limit)) }).map((_, idx) => {
                    const pageNum = idx + 1
                    // ページ数が多い場合、前後3ページと最後のページのみ表示
                    const maxPages = Math.ceil(totalCount / parseInt(limit))
                    if (maxPages <= 7 || pageNum === 1 || pageNum === maxPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className={`px-2 py-1 rounded ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={`dots-${pageNum}`} className="px-1">...</span>
                    }
                    return null
                  })}
                </div>

                <button
                  onClick={() => {
                    const maxPage = Math.ceil(totalCount / parseInt(limit))
                    setCurrentPage(Math.min(maxPage, currentPage + 1))
                  }}
                  disabled={currentPage >= Math.ceil(totalCount / parseInt(limit))}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ
                </button>
              </div>
            )}
            </>
          )}

          {!loading && cards.length === 0 && (
            <p className="text-center text-gray-600">カードが見つかりません</p>
          )}
        </div>
      </div>

      {/* Snidan URL入力モーダル */}
      {showSnidanUrlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">スニダンのURLを指定</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                スニダンの商品URL
              </label>
              <input
                type="text"
                placeholder="https://snkrdunk.com/apparels/..."
                value={snidanUrl}
                onChange={(e) => setSnidanUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                例: https://snkrdunk.com/apparels/671486
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSnidanUrlModal(false)
                    setSnidanUrl('')
                  }}
                  disabled={snidanModalLoading}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveSnidanUrl}
                  disabled={snidanModalLoading || !snidanUrl.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {snidanModalLoading ? '保存中...' : '保存'}
                </button>
              </div>
              {selectedCard?.snidan_apparel_id && (
                <button
                  onClick={deleteSnidanLink}
                  disabled={snidanModalLoading}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                >
                  {snidanModalLoading ? '削除中...' : 'リンク解除'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 鑑定番号検索モーダル */}
      {showCertNumberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">鑑定番号で検索</h3>

            {certNumberError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {certNumberError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PSA 鑑定番号
              </label>
              <input
                type="text"
                placeholder="例: 137506896"
                value={certNumberInput}
                onChange={(e) => setCertNumberInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchByCertNumber()
                  }
                }}
                disabled={certNumberLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-2">
                PSA Card API から spec ID を取得します
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCertNumberModal(false)
                  setCertNumberInput('')
                  setCertNumberError(null)
                }}
                disabled={certNumberLoading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={searchByCertNumber}
                disabled={certNumberLoading || !certNumberInput.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {certNumberLoading ? '検索中...' : '検索'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 詳細モーダル */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-lg md:rounded-lg shadow-lg w-full md:max-w-2xl md:mx-4 max-h-screen overflow-y-auto">
            <div className="p-8">
              {/* ヘッダー */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    {selectedCard.set.year}年 {selectedCard.set.set_code && `[${selectedCard.set.set_code}]`}{' '}
                    {selectedCard.set.set_name}
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedCard.card_name}
                    {selectedCard.card_number && <span className="text-gray-600"> #{selectedCard.card_number}</span>}
                  </h2>
                  {selectedCard.card_name_ja && (
                    <p className="text-lg text-gray-600 mt-2">{selectedCard.card_name_ja}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* 画像 */}
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

              {/* 詳細情報 */}
              <div className="space-y-4">
                {selectedCard.variety && (
                  <div>
                    <p className="text-sm text-gray-500">バリエーション</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedCard.variety}</p>
                  </div>
                )}

                {/* PSA グレーディング統計 - 3カラム */}
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

                {/* チャートセクション */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-500">価格チャート</p>
                    <div className="flex gap-1 items-center">
                      {chartLoading && <p className="text-xs text-gray-500">読み込み中...</p>}
                      {chartData && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setChartPeriod('1month')
                              fetchChartData(selectedCard.psa_spec_id, '1month')
                            }}
                            className={`text-xs px-2 py-1 rounded ${chartPeriod === '1month' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                          >
                            1ヶ月
                          </button>
                          <button
                            onClick={() => {
                              setChartPeriod('3months')
                              fetchChartData(selectedCard.psa_spec_id, '3months')
                            }}
                            className={`text-xs px-2 py-1 rounded ${chartPeriod === '3months' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                          >
                            3ヶ月
                          </button>
                        </div>
                      )}
                      {!chartData && (
                        <button
                          onClick={() => fetchChartData(selectedCard.psa_spec_id, chartPeriod)}
                          disabled={chartLoading}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          チャートを表示
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="min-h-[250px] bg-white">
                    {chartData && chartData.length > 0 && (
                      <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => v ? `¥${Math.round(v / 10000)}万` : '0'} />
                        <Tooltip
                          formatter={(value: any) => value ? `¥${Number(value).toLocaleString()}` : '-'}
                          labelFormatter={(label) => `日付: ${label}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="psa10Official" stroke="#2563eb" name="PSA公式 10" dot={false} connectNulls />
                        <Line dataKey="psa9Official" stroke="#93c5fd" name="PSA公式 9" dot={false} connectNulls />
                        <Line dataKey="psa10Snidan" stroke="#ea580c" name="Snidan 10" dot={false} connectNulls />
                        <Line dataKey="psa9Snidan" stroke="#fdba74" name="Snidan 9" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 価格データ - テーブルレイアウト */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-500">価格データ（直近3日平均）</p>
                    <button
                      onClick={fetchPriceForSelectedCard}
                      disabled={modalPriceLoading}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      {modalPriceLoading ? '取得中...' : '価格を取得'}
                    </button>
                  </div>
                  {modalPriceError && (
                    <div className="mb-4 p-2 bg-red-50 text-red-700 rounded text-sm">
                      {modalPriceError}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b">
                          <th className="px-2 py-2 text-left">グレード</th>
                          <th className="px-2 py-2 text-right">公式価格</th>
                          <th className="px-2 py-2 text-right">スニダン価格</th>
                          <th className="px-2 py-2 text-right">公式件数</th>
                          <th className="px-2 py-2 text-right">スニダン件数</th>
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
                          <td className="px-2 py-2 text-right text-gray-700">
                            {selectedCard.psa_psa10_qty_3d || '—'}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-700">
                            {selectedCard.snidan_psa10_qty_3d || '—'}
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
                          <td className="px-2 py-2 text-right text-gray-700">
                            {selectedCard.psa_psa9_qty_3d || '—'}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-700">
                            {selectedCard.snidan_psa9_qty_3d || '—'}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-2 py-2 font-semibold">差額</td>
                          <td className="px-2 py-2 text-right">
                            <div className="text-red-600 font-semibold">
                              {selectedCard.psa_psa10_avg_price_3d && selectedCard.psa_psa9_avg_price_3d
                                ? `¥${(selectedCard.psa_psa10_avg_price_3d - selectedCard.psa_psa9_avg_price_3d).toLocaleString()}`
                                : '—'}
                            </div>
                            <div className="text-red-600 text-xs">
                              {selectedCard.psa_psa10_avg_price_3d && selectedCard.psa_psa9_avg_price_3d && selectedCard.psa_psa9_avg_price_3d > 0
                                ? `(${Math.round((selectedCard.psa_psa10_avg_price_3d / selectedCard.psa_psa9_avg_price_3d) * 100)}%)`
                                : '—'}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="text-gray-900 font-semibold">
                              {selectedCard.snidan_psa10_avg_price_3d && selectedCard.snidan_psa9_avg_price_3d
                                ? `¥${(selectedCard.snidan_psa10_avg_price_3d - selectedCard.snidan_psa9_avg_price_3d).toLocaleString()}`
                                : '—'}
                            </div>
                            <div className="text-gray-900 text-xs">
                              {selectedCard.snidan_psa10_avg_price_3d && selectedCard.snidan_psa9_avg_price_3d && selectedCard.snidan_psa9_avg_price_3d > 0
                                ? `(${Math.round((selectedCard.snidan_psa10_avg_price_3d / selectedCard.snidan_psa9_avg_price_3d) * 100)}%)`
                                : '—'}
                            </div>
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 販売履歴セクション */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-500">販売履歴</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSalesGrade(10)
                          fetchSalesHistory(selectedCard.psa_spec_id, 'psa', 10)
                          if (selectedCard.snidan_apparel_id) {
                            fetchSalesHistory(selectedCard.psa_spec_id, 'snidan', 10, selectedCard.snidan_apparel_id)
                          }
                        }}
                        className={`px-3 py-1 rounded text-sm ${salesGrade === 10 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                      >
                        PSA10
                      </button>
                      <button
                        onClick={() => {
                          setSalesGrade(9)
                          fetchSalesHistory(selectedCard.psa_spec_id, 'psa', 9)
                          if (selectedCard.snidan_apparel_id) {
                            fetchSalesHistory(selectedCard.psa_spec_id, 'snidan', 9, selectedCard.snidan_apparel_id)
                          }
                        }}
                        className={`px-3 py-1 rounded text-sm ${salesGrade === 9 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                      >
                        PSA9
                      </button>
                    </div>
                  </div>

                  {/* 2列レイアウト */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PSA公式 */}
                    <div>
                      <h4 className="text-xs font-semibold text-red-600 mb-2">PSA公式</h4>
                      {psaSalesHistory.length > 0 ? (
                        <div className="overflow-x-auto max-h-48 overflow-y-auto border rounded">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-100">
                              <tr>
                                <th className="text-left px-2 py-1">日付</th>
                                <th className="text-right px-2 py-1">価格</th>
                                <th className="text-center px-2 py-1">種別</th>
                              </tr>
                            </thead>
                            <tbody>
                              {psaSalesHistory.map((sale, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-2 py-1">{sale.saleDate?.slice(0, 10)}</td>
                                  <td className="text-right px-2 py-1 font-semibold">¥{sale.priceJpy.toLocaleString()}</td>
                                  <td className="text-center px-2 py-1">
                                    <span className="inline-block px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                      [{sale.saleTypeLabel || '?'}]
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                          {salesLoading ? '読み込み中...' : 'データなし'}
                        </p>
                      )}
                    </div>

                    {/* Snidan */}
                    {selectedCard.snidan_apparel_id && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Snidan</h4>
                        {snidanSalesHistory.length > 0 ? (
                          <div className="overflow-x-auto max-h-48 overflow-y-auto border rounded">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-gray-100">
                                <tr>
                                  <th className="text-left px-2 py-1">日付・時刻</th>
                                  <th className="text-right px-2 py-1">価格</th>
                                </tr>
                              </thead>
                              <tbody>
                                {snidanSalesHistory.map((sale, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-2 py-1">{sale.soldAt?.slice(0, 16)}</td>
                                    <td className="text-right px-2 py-1 font-semibold">¥{sale.priceJpy.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                            {salesLoading ? '読み込み中...' : 'データなし'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex gap-3">
                    <a
                      href={`https://www.psacard.com/spec/psa/${selectedCard.psa_spec_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                    >
                      PSA Cardで詳細を見る
                    </a>
                    {selectedCard.snidan_apparel_id && (
                      <a
                        href={`https://snkrdunk.com/apparels/${selectedCard.snidan_apparel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-center"
                      >
                        スニダンで見る
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSnidanUrl('')
                      setShowSnidanUrlModal(true)
                    }}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    {selectedCard.snidan_apparel_id ? 'スニダンのURLを訂正' : 'スニダンのURLを指定'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
