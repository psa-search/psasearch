'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface SnidanCard {
  id: number
  snidan_apparel_id: string
  snidan_name_ja: string
  snidan_code: string | null
  snidan_image_url: string | null
  psa_spec_id: number | null
  is_valid: boolean
  scraped_at: string
}

export default function SnidanCardsPage() {
  const [cards, setCards] = useState<SnidanCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ linked: 0, unlinked: 0, multiple: 0 })
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false)
  const [showMasterBallOnly, setShowMasterBallOnly] = useState(false)
  const [showNeoOnly, setShowNeoOnly] = useState(false)
  const [showExcludedOnly, setShowExcludedOnly] = useState(false)
  const [excludedCards, setExcludedCards] = useState<SnidanCard[]>([])
  const [togglingApparelId, setTogglingApparelId] = useState<string | null>(null)
  const [scrapingResult, setScrapingResult] = useState<any>(null)
  const [autoLinking, setAutoLinking] = useState(false)
  const [autoLinkResult, setAutoLinkResult] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [scrapingVariations, setScrapingVariations] = useState(false)
  const [variationsResult, setVariationsResult] = useState<any>(null)
  const [linkModalTarget, setLinkModalTarget] = useState<{ apparelId: string; snidanCode: string | null; cardName: string } | null>(null)
  const [linkCandidates, setLinkCandidates] = useState<any[]>([])
  const [linkCandidatesLoading, setLinkCandidatesLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  // 除外/復活を切り替え
  const toggleValidity = async (apparelId: string, currentValid: boolean) => {
    setTogglingApparelId(apparelId)

    // スクロール位置を記憶
    const scrollPosition = window.scrollY

    try {
      const response = await fetch('/api/snidan-cards/toggle-validity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apparelId,
          isValid: !currentValid,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '切り替えに失敗しました')
      }

      // 一覧を再取得
      await fetchCards()

      // スクロール位置を復元（遅延）
      setTimeout(() => {
        window.scrollTo(0, scrollPosition)
      }, 500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setTogglingApparelId(null)
    }
  }

  // 一覧取得
  const fetchCards = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (showUnlinkedOnly) {
        params.append('unlinked_only', 'true')
      }
      if (showMasterBallOnly) {
        params.append('keyword', 'マスターボール')
      }
      const response = await fetch(`/api/snidan-cards?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch cards')
      }

      // フィルタリング
      let filteredCards = (data.cards || []).filter(
        (card: SnidanCard) => {
          if (!card.snidan_code) return true
          // // "M4 " で始まるコード、または " EN " を含むコードを除外
          // if (card.snidan_code.startsWith('M4 ') || card.snidan_code.includes(' EN ')) {
          //   return false
          // }
          // "neo シリーズのみ表示" がチェックされている場合
          if (showNeoOnly) {
            return card.snidan_code.toLowerCase().startsWith('neo')
          }
          return true
        }
      )
      setCards(filteredCards)
      setStats(data.stats || { linked: 0, unlinked: 0, multiple: 0 })

      // 除外済みカードを取得
      const { data: excluded } = await supabase
        .from('snidan_cards')
        .select('*')
        .eq('is_valid', false)
        .order('id', { ascending: true })

      setExcludedCards(excluded || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // スクレイピング実行
  const runScraping = async () => {
    setLoading(true)
    setError(null)
    setScrapingResult(null)
    setAutoLinkResult(null)
    try {
      const response = await fetch('/api/snidan/scrape-all?force=true')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Scraping failed')
      }

      setScrapingResult(data)

      // スクレイピング完了後、自動紐づけを開始
      await runAutoLinking()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // psa_cards に反映
  const syncToPsa = async () => {
    setSyncing(true)
    setError(null)
    setSyncResult(null)
    try {
      const response = await fetch('/api/snidan-cards/sync-to-psa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setSyncResult(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSyncing(false)
    }
  }


  // バリエーション取得
  const scrapeVariations = async () => {
    setScrapingVariations(true)
    setError(null)
    setVariationsResult(null)
    try {
      const response = await fetch('/api/snidan/scrape-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Scraping variations failed')
      }

      setVariationsResult(data)
      // 完了後、一覧を再取得
      await fetchCards()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setScrapingVariations(false)
    }
  }

  // 自動紐づけ実行
  const runAutoLinking = async () => {
    setAutoLinking(true)
    setError(null)
    try {
      const response = await fetch('/api/snidan-cards/auto-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Auto-linking failed')
      }

      setAutoLinkResult(data)
      // 完了後、一覧を再取得
      await fetchCards()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAutoLinking(false)
    }
  }

  // モーダルを開いて候補を検索
  const openLinkModal = async (apparelId: string, snidanCode: string | null, cardName: string) => {
    setLinkModalTarget({ apparelId, snidanCode, cardName })
    setLinkCandidates([])
    setLinkError(null)
    setLinkCandidatesLoading(true)

    if (!snidanCode) {
      setLinkError('スニダンコードがありません')
      setLinkCandidatesLoading(false)
      return
    }

    try {
      // 特殊フォーマットの処理
      let normalizedCode = snidanCode
      // "#" を削除（例：DP4 #181 → DP4 181）
      normalizedCode = normalizedCode.replace(/#\s*/, '')

      // PMCG シリーズの特殊処理（PMCG- または PMCG で始まる）
      if (normalizedCode.startsWith('PMCG')) {
        // PMCG-Blue/Red/Green/QS など または PMCGI など をセットコードに変換
        const pmcgMatch = normalizedCode.match(/^PMCG-?([A-Za-z0-9]+)\s+No\.(\d+)/)
        if (pmcgMatch) {
          const variant = pmcgMatch[1].toLowerCase()
          const cardNum = pmcgMatch[2]

          let setLetter = ''
          if (variant.startsWith('blue')) {
            setLetter = 'E' // OPE
          } else if (variant.startsWith('red')) {
            setLetter = 'R' // OPR
          } else if (variant.startsWith('green')) {
            setLetter = 'G' // OPG
          } else if (variant.startsWith('g')) {
            setLetter = 'G' // OPG (G1, G2, G3)
          } else if (variant.startsWith('p')) {
            setLetter = 'M' // OPM
          } else {
            // その他（QS, I など）は最初の大文字を使用
            const match = pmcgMatch[1].match(/^[A-Za-z]/i)
            if (match) {
              setLetter = match[0].toUpperCase()
            }
          }

          if (setLetter) {
            normalizedCode = `OP${setLetter} ${cardNum}`
          } else {
            // "No." を削除
            normalizedCode = normalizedCode.replace(/\s+No\.\s*/, ' ')
          }
        } else {
          // "No." を削除
          normalizedCode = normalizedCode.replace(/\s+No\.\s*/, ' ')
        }
      } else if (normalizedCode.toLowerCase().startsWith('neo')) {
        // neo シリーズの場合は "No." を削除
        normalizedCode = normalizedCode.replace(/\s+No\.\s*/, ' ')
      }

      // snidanコードから setCode と cardNumber を抽出
      const codeMatch = normalizedCode.match(/^([A-Za-z0-9\-+]+)\s+(\d+)/)
      if (!codeMatch) {
        setLinkError('スニダンコードのパースに失敗しました')
        setLinkCandidatesLoading(false)
        return
      }

      let setCode = codeMatch[1]
      let cardNumber = codeMatch[2]

      // cardNumber をそのまま送る（find-candidates で先頭ゼロの有無で検索）
      const response = await fetch('/api/snidan-cards/find-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setCode,
          cardNumber,
          masterBallOnly: showMasterBallOnly
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '候補検索に失敗しました')
      }

      setLinkCandidates(data.candidates || [])
    } catch (err) {
      setLinkError((err as Error).message)
    } finally {
      setLinkCandidatesLoading(false)
    }
  }

  // 候補から紐づけを確定
  const linkCardFromCandidate = async (specId: number) => {
    if (!linkModalTarget) return

    setLinkCandidatesLoading(true)
    setLinkError(null)

    // スクロール位置を記憶
    const scrollPosition = window.scrollY

    try {
      const response = await fetch('/api/snidan-cards/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apparelId: linkModalTarget.apparelId,
          specId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '紐づけに失敗しました')
      }

      // 一覧を再取得
      await fetchCards()

      // スクロール位置を復元（遅延）
      setTimeout(() => {
        window.scrollTo(0, scrollPosition)
      }, 500)

      // モーダルを閉じる
      setLinkModalTarget(null)
      setLinkCandidates([])
    } catch (err) {
      setLinkError((err as Error).message)
    } finally {
      setLinkCandidatesLoading(false)
    }
  }

  useEffect(() => {
    fetchCards()
  }, [showUnlinkedOnly, showMasterBallOnly, showNeoOnly, showExcludedOnly])

  useEffect(() => {
    if (!linkModalTarget) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLinkModalTarget(null)
        setLinkCandidates([])
        setLinkError(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [linkModalTarget])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Snidan カード一覧</h1>
          <p className="text-gray-600 mb-6">Snidan の全カードを取得して PSA と紐付け</p>

          {/* ボタン */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <button
              onClick={runScraping}
              disabled={loading || autoLinking || syncing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              {loading ? 'スクレイピング中...' : 'スクレイピング + 自動紐づけ'}
            </button>
            <button
              onClick={runAutoLinking}
              disabled={loading || autoLinking || syncing}
              className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              {autoLinking ? '自動紐づけ中...' : '自動紐づけだけ'}
            </button>
            <button
              onClick={syncToPsa}
              disabled={loading || autoLinking || syncing}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              {syncing ? 'PSA_cardsに反映中...' : 'PSA_cardsに反映'}
            </button>
            <button
              onClick={scrapeVariations}
              disabled={loading || autoLinking || syncing || scrapingVariations}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              {scrapingVariations ? 'バリエーション取得中...' : 'バリエーション取得'}
            </button>
            <Link href="/cards-list" className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-center">
              カード一覧に戻る
            </Link>
          </div>

          {/* フィルター */}
          <div className="mb-6 flex items-center gap-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="unlinked-only"
                checked={showUnlinkedOnly}
                onChange={(e) => setShowUnlinkedOnly(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="unlinked-only" className="cursor-pointer text-gray-700">
                未リンクのみ表示
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="master-ball-only"
                checked={showMasterBallOnly}
                onChange={(e) => setShowMasterBallOnly(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="master-ball-only" className="cursor-pointer text-gray-700">
                マスターボールのみ
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="neo-only"
                checked={showNeoOnly}
                onChange={(e) => setShowNeoOnly(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="neo-only" className="cursor-pointer text-gray-700">
                neo シリーズのみ
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="excluded-only"
                checked={showExcludedOnly}
                onChange={(e) => setShowExcludedOnly(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="excluded-only" className="cursor-pointer text-gray-700">
                除外済みのみ表示
              </label>
            </div>
          </div>

          {/* スクレイピング進行中 */}
          {loading && scrapingResult && !autoLinking && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold text-blue-900 mb-2">スクレイピング完了</h3>
              <p className="text-sm text-blue-700">取得件数: {scrapingResult.count}</p>
            </div>
          )}

          {/* 自動紐づけ進行中 */}
          {autoLinking && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-bold text-amber-900 mb-2">自動紐づけ処理中...</h3>
              <p className="text-sm text-amber-700">Snidan カードと PSA カードをマッチング中です...</p>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-600 animate-pulse" style={{ width: '50%' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* 自動紐づけ結果 */}
          {autoLinkResult && !autoLinking && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-bold text-green-900 mb-2">自動紐づけ完了</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">紐付け成功</p>
                  <p className="text-2xl font-bold text-green-600">{autoLinkResult.linked}</p>
                </div>
                <div>
                  <p className="text-gray-600">複数件</p>
                  <p className="text-2xl font-bold text-yellow-600">{autoLinkResult.multipleMatches}</p>
                </div>
                <div>
                  <p className="text-gray-600">見つからない</p>
                  <p className="text-2xl font-bold text-red-600">{autoLinkResult.notFound}</p>
                </div>
              </div>
            </div>
          )}

          {/* PSA反映結果 */}
          {syncResult && !syncing && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold text-blue-900 mb-2">PSA_cards への反映完了</h3>
              <p className="text-lg">
                <span className="font-bold text-blue-600">{syncResult.updated}</span>
                <span className="text-gray-600"> 件を psa_cards に反映しました</span>
              </p>
            </div>
          )}

          {/* バリエーション取得結果 */}
          {variationsResult && !scrapingVariations && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h3 className="font-bold text-indigo-900 mb-2">バリエーション取得完了</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">新規バリエーション</p>
                  <p className="text-2xl font-bold text-indigo-600">{variationsResult.newVariations}</p>
                </div>
                <div>
                  <p className="text-gray-600">既存更新</p>
                  <p className="text-2xl font-bold text-indigo-600">{variationsResult.updated}</p>
                </div>
              </div>
            </div>
          )}

          {/* 統計 */}
          {!scrapingResult && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold text-blue-900 mb-2">現在の状態</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">紐付き済み</p>
                  <p className="text-2xl font-bold text-green-600">{stats.linked}</p>
                </div>
                <div>
                  <p className="text-gray-600">未紐付け</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.unlinked}</p>
                </div>
                <div>
                  <p className="text-gray-600">複数件</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.multiple}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* テーブル */}
        {!loading && ((showExcludedOnly && excludedCards.length > 0) || (!showExcludedOnly && cards.length > 0)) && (
          <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">コード</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">カード名</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">ステータス</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Spec ID</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">アクション</th>
                </tr>
              </thead>
              <tbody>
                {(showExcludedOnly ? excludedCards : cards).map((card, idx) => (
                  <tr key={card.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-mono text-gray-700 text-xs">{card.snidan_code || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <a
                        href={`https://snkrdunk.com/apparels/${card.snidan_apparel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {card.snidan_name_ja}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {card.psa_spec_id ? (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                          ✓ 紐付き
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                          未紐付け
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 text-sm">
                      {card.psa_spec_id ? (
                        <Link
                          href={`/cards-list?search=${card.psa_spec_id}`}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {card.psa_spec_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center flex-wrap">
                        {showExcludedOnly ? (
                          <button
                            onClick={() => toggleValidity(card.snidan_apparel_id, card.is_valid)}
                            disabled={togglingApparelId === card.snidan_apparel_id}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                          >
                            {togglingApparelId === card.snidan_apparel_id ? '処理中...' : '復活'}
                          </button>
                        ) : (
                          <>
                            {!card.psa_spec_id && (
                              <button
                                onClick={() => openLinkModal(card.snidan_apparel_id, card.snidan_code, card.snidan_name_ja)}
                                className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
                              >
                                紐づけ
                              </button>
                            )}
                            <button
                              onClick={() => toggleValidity(card.snidan_apparel_id, card.is_valid)}
                              disabled={togglingApparelId === card.snidan_apparel_id}
                              className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                            >
                              {togglingApparelId === card.snidan_apparel_id ? '処理中...' : '除外'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && cards.length === 0 && !error && (
          <p className="text-center text-gray-600">カードがありません。スクレイピングを実行してください。</p>
        )}
      </div>

      {/* 紐づけモーダル */}
      {linkModalTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">紐づけ候補を選択</h3>
            <p className="text-sm text-gray-600 mb-4">{linkModalTarget.cardName}</p>

            {linkError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {linkError}
              </div>
            )}

            {linkCandidatesLoading && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                候補を検索中...
              </div>
            )}

            {!linkCandidatesLoading && linkCandidates.length === 0 && !linkError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                マッチする候補が見つかりません
              </div>
            )}

            {!linkCandidatesLoading && linkCandidates.length > 0 && (
              <div className="space-y-2 mb-4">
                {linkCandidates.map((candidate) => {
                  let imageUrl = null
                  if (candidate.image_urls && candidate.image_urls.length > 0) {
                    const url = candidate.image_urls[0]
                    if (url.startsWith('http')) {
                      imageUrl = url
                    } else {
                      // 画像IDから CloudFront URL を構築
                      imageUrl = `https://d1htnxwo4o0jhw.cloudfront.net/spec/${candidate.psa_spec_id}/${url}.jpg`
                    }
                  }

                  return (
                    <button
                      key={candidate.psa_spec_id}
                      onClick={() => linkCardFromCandidate(candidate.psa_spec_id)}
                      disabled={linkCandidatesLoading}
                      className="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-orange-50 hover:border-orange-300 transition-colors disabled:bg-gray-100 flex gap-3"
                    >
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={candidate.card_name}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{candidate.card_name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {candidate.set_code?.toUpperCase()} {candidate.card_number}
                        </div>
                        {candidate.variety && (
                          <div className="text-xs text-gray-500 mt-1">{candidate.variety}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLinkModalTarget(null)
                  setLinkCandidates([])
                  setLinkError(null)
                }}
                disabled={linkCandidatesLoading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
