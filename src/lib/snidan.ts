import * as cheerio from 'cheerio'
import { getCached, setCached } from './cache'
import type { PriceChart, PricePoint, SearchResult } from '@/types'

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

/**
 * スニダン検索ページ（HTML）から商品一覧を取得
 */
export async function searchCards(
  brand: 'pokemon' | 'onepiece',
  page = 1,
  perPage = 30
): Promise<SearchResult[]> {
  const cacheKey = `snidan:search:${brand}:${page}`
  const cached = getCached<SearchResult[]>(cacheKey)
  if (cached) return cached

  const categoryIds = brand === 'pokemon' ? '6%2F33' : '6'
  const url = `${BASE}/search?searchCategoryIds=${categoryIds}&brandIds=${brand}&sort=recommend&itemConditions=psa_10&itemSizes=quantity_1&isSaleOnly=true&page=${page}`

  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Snidan search failed: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const results: SearchResult[] = []

  // Next.jsのSSRデータから商品情報を抽出
  $('a[href*="/apparels/"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/\/apparels\/(\d+)\/used\/(\d+)/)
    if (!match) return

    const apparelId = parseInt(match[1])
    const listingId = parseInt(match[2])

    // 重複排除
    if (results.find((r) => r.apparelId === apparelId)) return

    const imgEl = $(el).find('img').first()
    const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || ''
    const name = imgEl.attr('alt') || ''

    // 価格を取得
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

  setCached(cacheKey, results)
  return results
}

/**
 * 個別商品の出品一覧を取得してPSA10/PSA9の現在価格を取得
 */
export async function getListings(apparelId: number, conditionId: number) {
  const cacheKey = `snidan:listings:${apparelId}:${conditionId}`
  const cached = getCached<{ price: number | null; count: number }>(cacheKey)
  if (cached) return cached

  const url = `${BASE}/v1/apparels/${apparelId}/used?perPage=20&page=1&conditionIds=${conditionId}&isSaleOnly=true&withAllColors=false`

  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) {
    const result = { price: null, count: 0 }
    setCached(cacheKey, result, 300) // 失敗時は短いキャッシュ
    return result
  }

  const data = await res.json()
  const items: Array<{ price: number }> = data.apparelUsedItems || []

  const result = {
    price: items.length > 0 ? items[0].price : null,
    count: items.length,
  }

  setCached(cacheKey, result)
  return result
}

/**
 * 価格チャートを取得
 */
export async function getPriceChart(
  apparelId: number,
  conditionId: number,
  range: 'all' | 'oneMonth' | 'oneWeek' = 'oneMonth'
): Promise<PriceChart> {
  const cacheKey = `snidan:chart:${apparelId}:${conditionId}:${range}`
  const cached = getCached<PriceChart>(cacheKey)
  if (cached) return cached

  const url = `${BASE}/v1/apparels/${apparelId}/sales-chart/used?range=${range}&salesChartOptionId=${conditionId}`

  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 3600 } })

  if (!res.ok) {
    const empty: PriceChart = { points: [], rangeKeys: [] }
    setCached(cacheKey, empty, 300)
    return empty
  }

  const data = await res.json()
  const points: PricePoint[] = (data.points || []).map(([ts, price]: [number, number]) => ({
    timestamp: ts,
    price,
  }))

  const chart: PriceChart = { points, rangeKeys: data.rangeKeys || [] }
  setCached(cacheKey, chart)
  return chart
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
