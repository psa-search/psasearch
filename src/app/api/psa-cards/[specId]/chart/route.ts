import { getPsaTimeSeries } from '@/lib/psa'
import { getPriceChart, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params
    const { searchParams } = new URL(request.url)
    const snidanId = searchParams.get('snidanId')
    const period = searchParams.get('period') || '3months'

    const specIdNum = parseInt(specId)
    const daysToKeep = period === '1month' ? 30 : 90

    // PSA公式チャートデータ取得（PSA10/9）
    const psaData10 = await getPsaTimeSeries(specId, 10)
    const psaData9 = await getPsaTimeSeries(specId, 9)

    // ドル円レート取得
    const { getDollarRate } = await import('@/lib/exchange-rate')
    const rate = await getDollarRate()

    // Snidanチャートデータ取得（snidanIdがある場合）
    let snidanData10: { timestamp: number; price: number }[] = []
    let snidanData9: { timestamp: number; price: number }[] = []

    if (snidanId) {
      console.log('[Chart API] snidanId:', snidanId, 'period:', period, 'daysToKeep:', daysToKeep)
      try {
        const chart10 = await getPriceChart(parseInt(snidanId), CONDITION_PSA10, 'all')
        const chart9 = await getPriceChart(parseInt(snidanId), CONDITION_PSA9, 'all')

        // 指定日数分のデータをフィルタ
        const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
        snidanData10 = chart10.points.filter(p => p.timestamp >= cutoffTime)
        snidanData9 = chart9.points.filter(p => p.timestamp >= cutoffTime)

        console.log('[Chart API] Snidan PSA10 points:', snidanData10.length)
        console.log('[Chart API] Snidan PSA9 points:', snidanData9.length)
      } catch (error) {
        console.error('[Chart API] Failed to fetch Snidan chart:', error)
      }
    } else {
      console.log('[Chart API] No snidanId provided')
    }

    // PSAデータも日数でフィルタ
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const psaData10Filtered = psaData10.filter((p: any) => p.date >= cutoffDate)
    const psaData9Filtered = psaData9.filter((p: any) => p.date >= cutoffDate)

    // 日付をキーにしてマージ
    const dateMap = new Map<
      string,
      {
        date: string
        psa10Official?: number | null
        psa9Official?: number | null
        psa10Snidan?: number | null
        psa9Snidan?: number | null
      }
    >()

    // PSA公式データをマージ（USD → JPY変換）
    psaData10Filtered.forEach((item: any) => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, { date: item.date })
      }
      const entry = dateMap.get(item.date)!
      entry.psa10Official = item.averagePrice ? Math.round(item.averagePrice * rate) : null
    })

    psaData9Filtered.forEach((item: any) => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, { date: item.date })
      }
      const entry = dateMap.get(item.date)!
      entry.psa9Official = item.averagePrice ? Math.round(item.averagePrice * rate) : null
    })

    // Snidanデータをマージ
    snidanData10.forEach((item: any) => {
      const date = new Date(item.timestamp).toISOString().split('T')[0]
      if (!dateMap.has(date)) {
        dateMap.set(date, { date })
      }
      const entry = dateMap.get(date)!
      entry.psa10Snidan = item.price
    })

    snidanData9.forEach((item: any) => {
      const date = new Date(item.timestamp).toISOString().split('T')[0]
      if (!dateMap.has(date)) {
        dateMap.set(date, { date })
      }
      const entry = dateMap.get(date)!
      entry.psa9Snidan = item.price
    })

    // 日付でソート
    const chartData = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    return Response.json({ data: chartData })
  } catch (error) {
    console.error('[API] Chart error:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
