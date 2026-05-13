import { unstable_cache } from 'next/cache'

const CACHE_TTL = 3600 // 1時間

/**
 * ドル円レートを取得（外部 API から）
 */
async function _getDollarRate(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    if (!res.ok) {
      console.error('Failed to fetch exchange rate')
      return 150 // フォールバック値
    }

    const data = await res.json()
    const jpy = data.rates?.JPY
    if (typeof jpy === 'number') {
      return jpy
    }
    return 150
  } catch (err) {
    console.error('Error fetching exchange rate:', err)
    return 150 // フォールバック値
  }
}

/**
 * ドル円レート（キャッシュ付き、1時間有効）
 */
export const getDollarRate = unstable_cache(
  _getDollarRate,
  ['dollar-rate'],
  { revalidate: CACHE_TTL }
)
