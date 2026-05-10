import { NextRequest, NextResponse } from 'next/server'
import { getPriceChart, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'
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
    const [chartPsa10All, chartPsa9All, chartPsa10Month, chartPsa9Month] = await Promise.all([
      getPriceChart(apparelId, CONDITION_PSA10, 'all'),
      getPriceChart(apparelId, CONDITION_PSA9, 'all'),
      getPriceChart(apparelId, CONDITION_PSA10, 'oneMonth'),
      getPriceChart(apparelId, CONDITION_PSA9, 'oneMonth'),
    ])

    // 全期間データが3ヶ月以上あれば直近90日を切り出す
    const psa10ThreeMonths = filterLastDays(chartPsa10All.points, 90)
    const psa9ThreeMonths = filterLastDays(chartPsa9All.points, 90)

    return NextResponse.json({
      apparelId,
      chartPsa10All: chartPsa10All.points,
      chartPsa9All: chartPsa9All.points,
      chartPsa10Month: chartPsa10Month.points,
      chartPsa9Month: chartPsa9Month.points,
      chartPsa10ThreeMonths: psa10ThreeMonths,
      chartPsa9ThreeMonths: psa9ThreeMonths,
      hasThreeMonths: psa10ThreeMonths.length > 0 && chartPsa10All.points.length > psa10ThreeMonths.length,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch card detail' }, { status: 500 })
  }
}
