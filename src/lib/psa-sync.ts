import { supabase } from './supabase'
import type { SnidanPsaMapping, PsaGradeMetrics } from '@/types/database'

const CACHE_TTL_HOURS = 24

/**
 * セット名を正規化（スペース削除、小文字化）
 */
function normalizeSetName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

/**
 * Snidan テキストからセット情報を抽出
 * 例: "MEGA Gengar ex SAR [M2a 240/193](High Class Pack "MEGA Dream ex")"
 */
function extractSetInfoFromSnidanName(snidanName: string): {
  setCode: string | null
  setNameHint: string | null
  cardNumber: string | null
} {
  // [M2a 240/193] から M2a と 240 を抽出
  const bracketMatch = snidanName.match(/\[([^\s]+)\s+(\d+)/)
  const setCode = bracketMatch ? bracketMatch[1] : null
  const cardNumber = bracketMatch ? bracketMatch[2] : null

  // "MEGA Dream ex" をシングルクォートで抽出
  const setNameMatch = snidanName.match(/"([^"]+)"/)
  const setNameHint = setNameMatch ? setNameMatch[1] : null

  return { setCode, setNameHint, cardNumber }
}

/**
 * Snidan カードを PSA カードにマッピング
 */
export async function matchSnidanToPsa(
  snidanApparelId: number,
  snidanName: string
): Promise<string | null> {
  // 既存マッピングを確認
  const { data: existing } = await supabase
    .from('snidan_psa_mapping')
    .select('psa_spec_id')
    .eq('snidan_apparel_id', snidanApparelId)
    .single()

  if (existing) return existing.psa_spec_id

  // Snidan テキストからセット情報を抽出
  const { setCode, setNameHint, cardNumber } = extractSetInfoFromSnidanName(snidanName)

  let psaCard = null

  // 戦略1: セット名ヒントで正規化比較（例: "MEGA Dream ex" と DB の "2025 Pokemon Japanese M2a-Mega Dream Ex" を比較）
  if (setNameHint) {
    const normalizedHint = normalizeSetName(setNameHint)
    const { data: sets } = await supabase.from('psa_sets').select('set_id, set_name')

    const matchingSet = sets?.find((s) => normalizeSetName(s.set_name).includes(normalizedHint))
    if (matchingSet) {
      const { data: result } = await supabase
        .from('psa_cards')
        .select('spec_id')
        .eq('psa_set_id', matchingSet.set_id)
        .ilike('card_name', `%${snidanName.split(':')[0].trim()}%`)
        .limit(1)
        .single()
      psaCard = result
    }
  }

  // 戦略2: カード番号で検索
  if (!psaCard && cardNumber) {
    const { data: result } = await supabase
      .from('psa_cards')
      .select('spec_id')
      .ilike('card_number', `%${cardNumber}%`)
      .limit(1)
      .single()
    psaCard = result
  }

  // 戦略3: メインカード名で検索
  if (!psaCard && snidanName.includes(':')) {
    const mainName = snidanName.split(':')[0].trim()
    const { data: result } = await supabase
      .from('psa_cards')
      .select('spec_id')
      .ilike('card_name', `%${mainName}%`)
      .limit(1)
      .single()
    psaCard = result
  }

  // 戦略4: 元の名前で検索
  if (!psaCard) {
    const { data: result } = await supabase
      .from('psa_cards')
      .select('spec_id')
      .ilike('card_name', `%${snidanName}%`)
      .limit(1)
      .single()
    psaCard = result
  }

  if (!psaCard) return null

  // マッピングを保存
  const mapping: SnidanPsaMapping = {
    snidan_apparel_id: snidanApparelId,
    psa_spec_id: psaCard.spec_id,
    snidan_name: snidanName,
    last_updated: new Date().toISOString(),
  }

  await supabase.from('snidan_psa_mapping').insert([mapping]).select()

  return psaCard.spec_id
}

/**
 * psacard.com から grade metrics を取得
 */
async function fetchPsaMetricsFromApi(specId: string): Promise<PsaGradeMetrics | null> {
  try {
    // Fetch population, price timeseries, and sales history for both grades
    const [pop10Res, pop9Res, price10Res, price9Res, sales10Res, sales9Res] = await Promise.all([
      fetch(
        `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/PSA/10/populationByGrade?filter=all`
      ),
      fetch(
        `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/PSA/9/populationByGrade?filter=all`
      ),
      fetch(
        `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/psa/priceSummary?g=10&tr=6&salesSummaryType=TIMESERIES&q=false&gt=ALL`
      ),
      fetch(
        `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/psa/priceSummary?g=9&tr=6&salesSummaryType=TIMESERIES&q=false&gt=ALL`
      ),
      fetch(
        `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/salesHistory?pn=1&ps=100&g=10&q=false&gt=ALL`
      ),
      fetch(
        `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/salesHistory?pn=1&ps=100&g=9&q=false&gt=ALL`
      ),
    ])

    if (!pop10Res.ok || !pop9Res.ok || !price10Res.ok || !price9Res.ok) {
      return null
    }

    const [popData10, popData9, priceData10, priceData9, salesData10, salesData9] = await Promise.all([
      pop10Res.json(),
      pop9Res.json(),
      price10Res.json(),
      price9Res.json(),
      sales10Res.ok ? sales10Res.json() : { sales: [] },
      sales9Res.ok ? sales9Res.json() : { sales: [] },
    ])

    // Extract population counts
    const totalGradingCount = popData10?.specTotal || null
    const grade10Count = popData10?.gradeTotal || null
    const grade9Count = popData9?.gradeTotal || null

    // Helper to extract TIMESERIES data from price response
    const extractTimeseries = (data: any) => {
      const timeseries = data?.salesSummary || []
      return timeseries.map((point: any) => ({
        date: point.date,
        // quantity が 0 なら売買がなかったということ → null にする
        price: point.metrics?.quantity > 0 && typeof point.metrics?.averagePrice === 'number'
          ? point.metrics.averagePrice
          : null,
      }))
    }

    // Helper to extract sales history into PricePoint format
    const extractSalesHistory = (data: any) => {
      const sales = data?.sales || []
      return sales.map((sale: any) => ({
        date: sale.saleDate,
        price: typeof sale.salePrice === 'number' ? sale.salePrice : null,
      }))
    }

    const metrics: PsaGradeMetrics = {
      spec_id: specId,
      total_grading_count: totalGradingCount,
      grade10_gem_count: grade10Count,
      grade10_price_history: extractTimeseries(priceData10),
      grade10_auction_sales: extractSalesHistory(salesData10),
      grade9_gem_count: grade9Count,
      grade9_price_history: extractTimeseries(priceData9),
      grade9_auction_sales: extractSalesHistory(salesData9),
      last_updated: new Date().toISOString(),
    }

    return metrics
  } catch (err) {
    console.error(`Failed to fetch PSA metrics for ${specId}:`, err)
    return null
  }
}

/**
 * PSA metrics を取得（キャッシュから、なければ fetch）
 */
export async function getPsaMetrics(specId: string): Promise<PsaGradeMetrics | null> {
  // キャッシュを確認
  const { data: cached, error } = await supabase
    .from('psa_grade_metrics')
    .select('*')
    .eq('spec_id', specId)
    .single()

  if (cached) {
    // キャッシュの有効期限を確認
    const lastUpdated = new Date(cached.last_updated)
    const now = new Date()
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)

    if (hoursDiff < CACHE_TTL_HOURS) {
      return cached
    }
  }

  // API から fetch
  const metrics = await fetchPsaMetricsFromApi(specId)
  if (!metrics) return null

  // キャッシュに保存
  await supabase.from('psa_grade_metrics').upsert([metrics]).select()

  return metrics
}

/**
 * Snidan ID から PSA metrics を取得（自動マッピング＋キャッシュ）
 */
export async function getPsaMetricsBySnidanId(
  snidanApparelId: number,
  snidanName: string
): Promise<PsaGradeMetrics | null> {
  const specId = await matchSnidanToPsa(snidanApparelId, snidanName)
  if (!specId) return null

  return getPsaMetrics(specId)
}
