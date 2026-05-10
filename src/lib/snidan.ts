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

/**
 * スニダン検索ページ（HTML）から商品一覧を取得
 */
async function _searchCards(brand: 'pokemon' | 'onepiece', page: number): Promise<SearchResult[]> {
  const categoryIds = brand === 'pokemon' ? '6%2F33' : '6'
  const url = `${BASE}/search?searchCategoryIds=${categoryIds}&brandIds=${brand}&sort=hottest&itemSizes=quantity_1&isSaleOnly=true&page=${page}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Snidan search failed: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const results: SearchResult[] = []

  $('a[href*="/apparels/"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/\/apparels\/(\d+)\/used\/(\d+)/)
    if (!match) return

    const apparelId = parseInt(match[1])
    const listingId = parseInt(match[2])

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

export const searchCards = unstable_cache(
  _searchCards,
  ['snidan-search'],
  { revalidate: TTL_SEARCH }
)

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
 * 価格チャートを取得
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

export const getPriceChart = unstable_cache(
  _getPriceChart,
  ['snidan-chart'],
  { revalidate: TTL_CHART }
)

/**
 * 販売履歴を取得
 */
async function _getSalesHistory(apparelId: number, perPage = 20): Promise<SalesRecord[]> {
  const url = `${BASE}/v1/apparels/${apparelId}/sales-history?size_id=0&page=1&per_page=${perPage}`

  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return []

  const data = await res.json()
  return (data.history || []).map((h: { price: number; date: string; condition: string }) => ({
    price: h.price,
    date: h.date,
    condition: h.condition,
  }))
}

export const getSalesHistory = unstable_cache(
  _getSalesHistory,
  ['snidan-sales-history'],
  { revalidate: TTL_SEARCH }
)

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
