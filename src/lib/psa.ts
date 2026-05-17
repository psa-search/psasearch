import { getCached, setCached } from './cache'
import type { PsaCardData, PsaGradeSummary } from '@/types'

const BASE = 'https://www.psacard.com/api/psa/researchJourney'

/**
 * PSA グレード別価格サマリー（eBay USD）
 */
export async function getPsaGradeSummary(specId: string): Promise<PsaCardData | null> {
  const cacheKey = `psa:grades:${specId}`
  const cached = getCached<PsaCardData>(cacheKey)
  if (cached) return cached

  const url = `${BASE}/spec/${specId}/psa/priceSummary?salesSummaryType=GRADES&q=false&gt=SINGLE_GRADED`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`PSA API failed: ${res.status}`)

    const data = await res.json()

    const gradeSummaries: PsaGradeSummary[] = (data.salesSummary || []).map(
      (s: {
        grade: number
        quantity: number
        minimumPrice: number
        maximumPrice: number
        averagePrice: number
        latestPrice: number
      }) => ({
        grade: s.grade,
        quantity: s.quantity,
        minimumPrice: s.minimumPrice,
        maximumPrice: s.maximumPrice,
        averagePrice: s.averagePrice,
        latestPrice: s.latestPrice,
      })
    )

    const result: PsaCardData = {
      specId,
      gradeSummaries,
      growthRate: null,
      salesCount: 0,
    }

    setCached(cacheKey, result)
    return result
  } catch {
    return null
  }
}

/**
 * PSA 販売履歴（eBay落札データ）
 */
export async function getPsaSalesHistory(specId: string, grade = 10, pageSize = 5) {
  const cacheKey = `psa:sales:${specId}:${grade}:${pageSize}`
  const cached = getCached<{
    sales: Array<{
      saleDate: string
      salePrice: number
      gradeValue: number
      saleType: string
      listingURL: string
    }>
    metrics: { growthRate: number; totalCount: number; averagePrice: number } | null
  }>(cacheKey)
  if (cached) return cached

  const url = `${BASE}/spec/${specId}/salesHistory?pn=1&ps=${pageSize}&g=${grade}&q=false&gt=SINGLE_GRADED`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`PSA sales API failed: ${res.status}`)

    const data = await res.json()

    const result = {
      sales: (data.sales || []).map(
        (s: {
          saleDate: string
          salePrice: number
          gradeValue: number
          saleType: string
          listingURL: string
        }) => ({
          saleDate: s.saleDate,
          salePrice: s.salePrice,
          gradeValue: s.gradeValue,
          saleType: s.saleType,
          listingURL: s.listingURL,
        })
      ),
      metrics: data.metrics
        ? {
            growthRate: data.metrics.growthRate,
            totalCount: data.metrics.totalCount,
            averagePrice: data.metrics.averagePrice,
          }
        : null,
    }

    setCached(cacheKey, result)
    return result
  } catch {
    return { sales: [], metrics: null }
  }
}

export async function getPsaTimeSeries(specId: string, grade: 10 | 9) {
  const cacheKey = `psa:timeseries:${specId}:${grade}`
  const cached = getCached<
    Array<{
      date: string
      averagePrice: number | null
    }>
  >(cacheKey)
  if (cached) return cached

  const url = `${BASE}/spec/${specId}/psa/priceSummary?g=${grade}&tr=6&salesSummaryType=TIMESERIES&q=false&gt=SINGLE_GRADED`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`PSA timeseries API failed: ${res.status}`)

    const data = await res.json()

    const result = (data.salesSummary || []).map(
      (s: {
        date: string
        metrics: {
          averagePrice: number
        }
      }) => ({
        date: s.date,
        averagePrice: s.metrics.averagePrice > 0 ? s.metrics.averagePrice : null,
      })
    )

    setCached(cacheKey, result)
    return result
  } catch {
    return []
  }
}
