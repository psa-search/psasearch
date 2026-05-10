import { getCached, setCached } from './cache'

const CACHE_KEY = 'usd_jpy_rate'

// フォールバックレート（取得失敗時）
const FALLBACK_RATE = 150

export async function getUsdJpyRate(): Promise<number> {
  const cached = getCached<number>(CACHE_KEY)
  if (cached) return cached

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=JPY', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error('fetch failed')
    const data = await res.json()
    const rate: number = data.rates.JPY
    setCached(CACHE_KEY, rate, 3600)
    return rate
  } catch {
    return FALLBACK_RATE
  }
}

export function usdToJpy(usd: number, rate: number): number {
  return Math.round(usd * rate)
}
