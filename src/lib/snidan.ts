import * as cheerio from 'cheerio'
import { unstable_cache } from 'next/cache'
import type { PriceChart, PricePoint, SearchResult, SalesRecord } from '@/types'

const BASE = 'https://snkrdunk.com'

const HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ja,en-US;q=0.9,en;q=0.8',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
}

// PSA10=22, PSA9=23
export const CONDITION_PSA10 = 22
export const CONDITION_PSA9 = 23

const TTL_SEARCH = 3600      // カード一覧: 1時間
const TTL_CHART = 86400      // チャート: 1日
const TTL_SALES_HISTORY = 300 // 販売履歴: 5分

/**
 * スニダン検索ページ（HTML）から商品一覧を取得
 */
async function _searchCards(brand: 'pokemon' | 'onepiece', page: number, keyword?: string): Promise<SearchResult[]> {
  const categoryIds = brand === 'pokemon' ? '6%2F33' : '6'
  let url = `${BASE}/search?searchCategoryIds=${categoryIds}&brandIds=${brand}&sort=hottest&itemSizes=quantity_1&isSaleOnly=true&page=${page}`

  if (keyword) {
    url += `&searchText=${encodeURIComponent(keyword)}`
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Snidan search failed: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const results: SearchResult[] = []

  $('a[href*="/apparels/"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/\/apparels\/(\d+)/)
    if (!match) return

    const apparelId = parseInt(match[1])
    const listingId = 0

    if (results.find((r) => r.apparelId === apparelId)) return

    const imgEl = $(el).find('img').first()
    const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || ''
    const name = imgEl.attr('alt') || ''

    const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text()
    const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0

    results.push({
      apparelId,
      listingId,
      name,
      localizedName: name,
      imageUrl,
      productNumber: '',
      price,
    })
  })

  return results
}

export async function searchCards(brand: 'pokemon' | 'onepiece', page: number, keyword?: string): Promise<SearchResult[]> {
  // キーワード検索の場合はキャッシュを使わない（毎回 Snidan に問い合わせ）
  if (keyword) {
    return _searchCards(brand, page, keyword)
  }

  // キーワードなしの場合はキャッシュを使う
  const cachedSearch = unstable_cache(
    _searchCards,
    ['snidan-search'],
    { revalidate: TTL_SEARCH }
  )
  return cachedSearch(brand, page)
}

/**
 * 個別商品の出品一覧を取得してPSA10/PSA9の現在価格を取得
 */
async function _getListings(apparelId: number, conditionId: number) {
  const url = `${BASE}/v1/apparels/${apparelId}/used?perPage=20&page=1&conditionIds=${conditionId}&isSaleOnly=true&withAllColors=false`

  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return { price: null, count: 0 }

  const data = await res.json()
  const items: Array<{ price: number }> = data.apparelUsedItems || []

  return {
    price: items.length > 0 ? items[0].price : null,
    count: items.length,
  }
}

export const getListings = unstable_cache(
  _getListings,
  ['snidan-listings'],
  { revalidate: TTL_SEARCH }
)

/**
 * 価格チャートを取得（DB キャッシュ対応）
 */
async function _getPriceChart(
  apparelId: number,
  conditionId: number,
  range: 'all' | 'oneMonth' | 'oneWeek' = 'oneMonth'
): Promise<PriceChart> {
  const url = `${BASE}/v1/apparels/${apparelId}/sales-chart/used?range=${range}&salesChartOptionId=${conditionId}`

  const res = await fetch(url, { headers: HEADERS })

  if (!res.ok) return { points: [], rangeKeys: [] }

  const data = await res.json()
  const points: PricePoint[] = (data.points || []).map(([ts, price]: [number, number]) => ({
    timestamp: ts,
    price,
  }))

  return { points, rangeKeys: data.rangeKeys || [] }
}

export async function getPriceChart(
  apparelId: number,
  conditionId: number,
  range: 'all' | 'oneMonth' | 'oneWeek' = 'oneMonth'
): Promise<PriceChart> {
  // DB キャッシュから取得を試みる
  try {
    const { supabase } = await import('./supabase')
    if (!supabase) throw new Error('Supabase not available')

    const { data: cached } = await supabase
      .from('snidan_price_charts')
      .select('points, range_keys, created_at')
      .eq('apparel_id', apparelId)
      .eq('condition_id', conditionId)
      .eq('range', range)
      .single()

    if (cached) {
      const createdAt = new Date(cached.created_at)
      const now = new Date()
      const minutesDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60)

      if (minutesDiff < 60) { // 1時間以内
        return {
          points: cached.points,
          rangeKeys: cached.range_keys || [],
        }
      }
    }
  } catch {
    // DB にない場合は API から取得
  }

  // API から取得
  const chart = await _getPriceChart(apparelId, conditionId, range)

  // DB に保存
  if (chart.points.length > 0) {
    try {
      const { supabase } = await import('./supabase')
      if (!supabase) throw new Error('Supabase not available')
      await supabase.from('snidan_price_charts').upsert([{
        apparel_id: apparelId,
        condition_id: conditionId,
        range,
        points: chart.points,
        range_keys: chart.rangeKeys,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'apparel_id,condition_id,range' })
    } catch {
      // DB 保存失敗は無視
    }
  }

  return chart
}

const THREE_DAYS_HOURS = 72

function parseHoursAgo(dateStr: string): number {
  const minMatch = dateStr.match(/(\d+)分前/)
  if (minMatch) return parseInt(minMatch[1]) / 60

  const hourMatch = dateStr.match(/(\d+)時間前/)
  if (hourMatch) return parseInt(hourMatch[1])

  if (dateStr === '昨日') return 24

  const dayMatch = dateStr.match(/(\d+)日前/)
  if (dayMatch) return parseInt(dayMatch[1]) * 24

  // "2026/05/06" 形式の絶対日付
  const absMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (absMatch) {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    return diffMs / (1000 * 60 * 60)
  }

  return 999999
}

async function fetchSalesPage(apparelId: number, conditionId: number, page: number): Promise<SalesRecord[]> {
  const url = `${BASE}/v1/apparels/${apparelId}/sales-history?page=${page}&per_page=100&condition_id=${conditionId}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return []
  const data = await res.json()
  return (data.history || []).map((h: { price: number; date: string; condition: string }) => ({
    price: h.price,
    date: h.date,
    condition: h.condition,
    hoursAgo: parseHoursAgo(h.date),
  }))
}

/**
 * PSA条件別に販売履歴を取得
 * 20件取得し、全件が3日以内なら次ページも取得（繰り返し）
 */
async function _getSalesHistory(apparelId: number, conditionId: number): Promise<SalesRecord[]> {
  const all: SalesRecord[] = []
  let page = 1
  while (true) {
    const records = await fetchSalesPage(apparelId, conditionId, page)
    all.push(...records)
    if (records.length < 100 || !records.every((r) => r.hoursAgo <= THREE_DAYS_HOURS)) break
    page++
  }
  return all
}

export async function getSalesHistory(apparelId: number, conditionId: number): Promise<SalesRecord[]> {
  // DB キャッシュから取得を試みる
  try {
    const { supabase } = await import('./supabase')
    if (!supabase) throw new Error('Supabase not available')

    const { data: cached } = await supabase
      .from('snidan_sales_history')
      .select('records, created_at')
      .eq('apparel_id', apparelId)
      .eq('condition_id', conditionId)
      .single()

    if (cached) {
      const createdAt = new Date(cached.created_at)
      const now = new Date()
      const minutesDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60)

      if (minutesDiff < 5) { // 5分以内
        return cached.records
      }
    }
  } catch {
    // DB にない場合は API から取得
  }

  // API から取得
  const history = await _getSalesHistory(apparelId, conditionId)

  // DB に保存
  if (history.length > 0) {
    try {
      const { supabase } = await import('./supabase')
      if (!supabase) throw new Error('Supabase not available')
      await supabase.from('snidan_sales_history').upsert([{
        apparel_id: apparelId,
        condition_id: conditionId,
        records: history,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'apparel_id,condition_id' })
    } catch {
      // DB 保存失敗は無視
    }
  }

  return history
}

export function countSalesWithinDays(records: SalesRecord[], days: number): number {
  return records.filter((r) => r.hoursAgo <= days * 24).length
}

/**
 * チャートデータから価格トレンド（%）を計算
 * 前半平均と後半平均を比較
 */
export function calcTrend(points: PricePoint[]): number | null {
  if (points.length < 4) return null

  const mid = Math.floor(points.length / 2)
  const firstHalf = points.slice(0, mid)
  const secondHalf = points.slice(mid)

  const avg = (arr: PricePoint[]) => arr.reduce((s, p) => s + p.price, 0) / arr.length

  const firstAvg = avg(firstHalf)
  const secondAvg = avg(secondHalf)

  if (firstAvg === 0) return null
  return Math.round(((secondAvg - firstAvg) / firstAvg) * 1000) / 10 // 小数1桁
}

/**
 * Snidan apparel page からカード情報を取得（DB キャッシュ対応）
 */
async function _getCardInfo(apparelId: number): Promise<{ name: string | null; imageUrl: string | null }> {
  try {
    const url = `${BASE}/apparels/${apparelId}`
    const res = await fetch(url)
    if (!res.ok) return { name: null, imageUrl: null }

    const html = await res.text()
    const $ = cheerio.load(html)

    // og:title からカード名を取得
    const name = $('meta[property="og:title"]').attr('content')

    // og:image から画像URL を取得
    const imageUrl = $('meta[property="og:image"]').attr('content')

    return {
      name: name || null,
      imageUrl: imageUrl || null,
    }
  } catch {
    return { name: null, imageUrl: null }
  }
}

export async function getCardInfo(apparelId: number): Promise<{ name: string | null; imageUrl: string | null }> {
  // DB キャッシュから取得を試みる
  try {
    const { supabase } = await import('./supabase')
    if (!supabase) throw new Error('Supabase not available')

    const { data } = await supabase
      .from('snidan_cards')
      .select('card_name, card_image_url')
      .eq('apparel_id', apparelId)
      .single()

    if (data) {
      return {
        name: data.card_name,
        imageUrl: data.card_image_url,
      }
    }
  } catch {
    // DB にない場合は Snidan から取得
  }

  // Snidan から取得
  const cardInfo = await _getCardInfo(apparelId)

  // DB に保存
  if (cardInfo.name || cardInfo.imageUrl) {
    try {
      const { supabase } = await import('./supabase')
      if (!supabase) throw new Error('Supabase not available')
      await supabase.from('snidan_cards').upsert([{
        apparel_id: apparelId,
        card_name: cardInfo.name,
        card_image_url: cardInfo.imageUrl,
      }])
    } catch {
      // DB 保存失敗は無視
    }
  }

  return cardInfo
}

/**
 * Snidan apparel page から商品名を取得 (deprecated: getCardInfo を使用)
 */
export async function getCardName(apparelId: number): Promise<string | null> {
  const info = await getCardInfo(apparelId)
  return info.name
}
