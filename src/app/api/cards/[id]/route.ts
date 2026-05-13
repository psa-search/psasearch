import { NextRequest, NextResponse } from 'next/server'
import { getPriceChart, getSalesHistory, countSalesWithinDays, getCardInfo, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'
import { matchSnidanToPsa, getPsaMetrics } from '@/lib/psa-sync'
import { getDollarRate } from '@/lib/exchange-rate'
import type { PricePoint } from '@/types'

/** allデータから直近N日分を切り出す */
function filterLastDays(points: PricePoint[], days: number): PricePoint[] {
  if (points.length === 0) return []
  const latest = points[points.length - 1].timestamp
  const cutoff = latest - days * 24 * 60 * 60 * 1000
  return points.filter((p) => p.timestamp >= cutoff)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const apparelId = parseInt(id)

  if (isNaN(apparelId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const [chartPsa10All, chartPsa9All, chartPsa10Month, chartPsa9Month, salesHistoryPsa10, salesHistoryPsa9, cardInfo, usdJpyRate] = await Promise.all([
      getPriceChart(apparelId, CONDITION_PSA10, 'all'),
      getPriceChart(apparelId, CONDITION_PSA9, 'all'),
      getPriceChart(apparelId, CONDITION_PSA10, 'oneMonth'),
      getPriceChart(apparelId, CONDITION_PSA9, 'oneMonth'),
      getSalesHistory(apparelId, CONDITION_PSA10),
      getSalesHistory(apparelId, CONDITION_PSA9),
      getCardInfo(apparelId),
      getDollarRate(),
    ])

    // Fetch PSA metrics (auto-match + cache)
    let psaMetrics = null
    if (cardInfo.name) {
      const specId = await matchSnidanToPsa(apparelId, cardInfo.name)
      if (specId) {
        psaMetrics = await getPsaMetrics(specId)
      }
    }

    // 全期間データが3ヶ月以上あれば直近90日を切り出す
    const psa10ThreeMonths = filterLastDays(chartPsa10All.points, 90)
    const psa9ThreeMonths = filterLastDays(chartPsa9All.points, 90)

    return NextResponse.json({
      apparelId,
      cardName: cardInfo.name,
      cardImageUrl: cardInfo.imageUrl,
      chartPsa10All: chartPsa10All.points,
      chartPsa9All: chartPsa9All.points,
      chartPsa10Month: chartPsa10Month.points,
      chartPsa9Month: chartPsa9Month.points,
      chartPsa10ThreeMonths: psa10ThreeMonths,
      chartPsa9ThreeMonths: psa9ThreeMonths,
      hasThreeMonths: psa10ThreeMonths.length > 0 && chartPsa10All.points.length > psa10ThreeMonths.length,
      salesHistoryPsa10,
      salesHistoryPsa9,
      salesCount3dPsa10: countSalesWithinDays(salesHistoryPsa10, 3),
      salesCount3dPsa9: countSalesWithinDays(salesHistoryPsa9, 3),
      psaMetrics,
      usdJpyRate,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch card detail' }, { status: 500 })
  }
}
