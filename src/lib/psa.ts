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
          listingURL: string
        }) => ({
          saleDate: s.saleDate,
          salePrice: s.salePrice,
          gradeValue: s.gradeValue,
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
