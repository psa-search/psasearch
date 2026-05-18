import { getPsaSalesHistory } from '@/lib/psa'
import { getSalesHistory, CONDITION_PSA10, CONDITION_PSA9, CONDITION_A } from '@/lib/snidan'

function saleTypeLabel(saleType: string): 'AUC' | 'BO' | 'FIX' | '?' {
  if (!saleType) return '?'
  
  const normalized = saleType.toLowerCase().trim()
  
  if (normalized.includes('auction')) return 'AUC'
  if (normalized.includes('best') && normalized.includes('offer')) return 'BO'
  if (normalized.includes('fixed') && normalized.includes('price')) return 'FIX'
  
  console.log('[Sales API] Unknown saleType:', saleType)
  return '?'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'psa'
    const grade = parseInt(searchParams.get('g') || '10') as 10 | 9 | 18
    const snidanId = searchParams.get('snidanId')

    console.log('[Sales API] source:', source, 'grade:', grade, 'snidanId:', snidanId)

    if (source === 'snidan') {
      if (!snidanId) {
        console.log('[Sales API] No snidanId provided')
        return Response.json({ sales: [], totalCount: 0 })
      }

      // Snidan販売履歴
      let conditionId: number
      if (grade === 10) {
        conditionId = CONDITION_PSA10
      } else if (grade === 9) {
        conditionId = CONDITION_PSA9
      } else {
        conditionId = CONDITION_A
      }
      console.log('[Sales API] Fetching Snidan sales with conditionId:', conditionId)
      const records = await getSalesHistory(parseInt(snidanId), conditionId)
      console.log('[Sales API] Snidan records:', records.length)

      const sales = records.map((record: any) => ({
        soldAt: record.soldAt,
        priceJpy: record.price,
        condition: record.condition,
      }))

      console.log('[Sales API] Snidan sales response:', sales)
      return Response.json({
        sales,
        totalCount: sales.length,
      })
    }

    // PSA公式販売履歴
    const data = await getPsaSalesHistory(specId, grade, 20)

    // ドル円レート取得
    const { getDollarRate } = await import('@/lib/exchange-rate')
    const rate = await getDollarRate()

    const sales = data.sales.map((sale: any) => {
      const label = saleTypeLabel(sale.saleType)
      console.log('[Sales API] saleType:', sale.saleType, '-> label:', label)
      return {
        saleDate: sale.saleDate,
        priceJpy: Math.round(sale.salePrice * rate),
        saleTypeLabel: label,
        listingURL: sale.listingURL,
      }
    })

    console.log('[Sales API] PSA sales response:', sales.length, 'items')
    return Response.json({
      sales,
      totalCount: data.metrics?.totalCount || 0,
    })
  } catch (error) {
    console.error('[API] Sales history error:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
