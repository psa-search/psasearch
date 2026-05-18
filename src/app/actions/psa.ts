'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSalesHistory, CONDITION_PSA10, CONDITION_PSA9 } from '@/lib/snidan'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PSA_GET_SET_ITEMS_URL = 'https://www.psacard.com/Pop/GetSetItems'
const CATEGORY_ID = 156940 // Pokemon

// Supabase から最新のクッキーを取得
async function getCookieHeader(): Promise<string> {
  const { data, error } = await supabase
    .from('cf_clearance_cookies')
    .select('cookies')
    .order('obtained_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data?.cookies) {
    throw new Error('Failed to fetch cookies from Supabase')
  }

  return data.cookies
}

async function scrapeCardsForSet(specId: number, setName: string, cookieHeader: string) {
  try {
    const body = new URLSearchParams({
      draw: '1',
      start: '0',
      length: '1000',
      search: '',
      headingID: specId.toString(),
      categoryID: CATEGORY_ID.toString(),
      isPSADNA: 'false',
    })

    const response = await fetch(PSA_GET_SET_ITEMS_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'ja;q=0.7',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'pragma': 'no-cache',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'cookie': cookieHeader,
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return { cards: [], error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const cards = []

    if (!data.data || !Array.isArray(data.data)) {
      return { cards: [], error: 'Invalid response format' }
    }

    // 最初の行は TOTAL POPULATION なので skip
    for (const item of data.data.slice(1)) {
      if (!item.SpecID || item.SpecID === 0) continue

      const totalGraded = item.GradeTotal || 0
      const grade10Count = item.Grade10 || 0
      const gemRate = totalGraded > 0 ? (grade10Count / totalGraded) * 100 : 0

      cards.push({
        psa_spec_id: item.SpecID,
        set_id: specId,
        card_number: item.CardNumber || '',
        card_name: item.SubjectName,
        card_name_ja: null,
        variety: item.Variety || '',
        total_graded: totalGraded,
        gem_count_psa10: grade10Count,
        gem_rate_psa10: Math.round(gemRate * 100) / 100,
        snidan_apparel_id: null,
        image_urls: null,
      })
    }

    return { cards, error: null }
  } catch (error) {
    return { cards: [], error: (error as Error).message }
  }
}

// 0件のセット全て を順番に更新
export async function updateAllEmptySets() {
  try {
    // card_count が 0 のセットを取得
    const { data: emptyCards, error: cardsError } = await supabase
      .from('psa_cards')
      .select('set_id, card_name')
      .limit(1)

    // set_id に対応するセットを取得（0件セット）
    const { data: emptySets, error: setsError } = await supabase
      .from('psa_sets')
      .select('psa_spec_id, set_name')

    if (setsError || !emptySets) {
      return { success: false, message: 'セット一覧取得エラー' }
    }

    // psa_cards に存在しないセット（0件セット）を抽出
    const filledSetIds = new Set(
      await supabase
        .from('psa_cards')
        .select('set_id', { count: 'exact' })
        .then(({ data }) => data?.map((c: any) => c.set_id) || [])
    )

    const emptySetsList = emptySets.filter((set: any) => !filledSetIds.has(set.psa_spec_id))

    let updated = 0
    for (const set of emptySetsList) {
      const result = await updateSetCards(set.psa_spec_id, set.set_name)
      if (result.success) {
        updated += 1
      }
    }

    return { success: true, message: `${updated}/${emptySetsList.length}セットを更新しました`, count: updated }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

export async function updateSetCards(specId: number, setName: string) {
  try {
    // Supabase から最新のクッキーを取得
    const cookieHeader = await getCookieHeader()

    const { cards, error } = await scrapeCardsForSet(specId, setName, cookieHeader)

    if (error) {
      return { success: false, message: `スクレイプエラー: ${error}`, cardCount: 0 }
    }

    if (cards.length === 0) {
      return { success: true, message: 'カードが見つかりませんでした', cardCount: 0 }
    }

    // DB に保存
    const { error: insertError } = await supabase
      .from('psa_cards')
      .upsert(cards, { onConflict: 'psa_spec_id' })

    if (insertError) {
      return { success: false, message: `保存エラー: ${insertError.message}`, cardCount: 0 }
    }

    revalidatePath(`/sets/${specId}`)
    revalidatePath('/sets')

    return { success: true, message: `${cards.length}枚のカードを保存しました`, cardCount: cards.length }
  } catch (error) {
    return { success: false, message: (error as Error).message, cardCount: 0 }
  }
}

// PSA の詳細ページから画像 ID を取得
async function scrapeCardImages(specId: number, cookieHeader: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.psacard.com/spec/psa/${specId}?g=10&tr=6&gt=SINGLE_GRADED`,
      {
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'accept-language': 'ja;q=0.7',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'x-requested-with': 'XMLHttpRequest',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'cookie': cookieHeader,
        }
      }
    )

    if (!response.ok) return []

    const html = await response.text()
    const imageIds: string[] = []

    // img[itemProp="contentUrl"] から CloudFront URL を抽出して imageId を取得
    const imageTagRegex = /<img[^>]*itemProp="contentUrl"[^>]*src="([^"]+)"[^>]*>/g
    let match
    const seenIds = new Set<string>()

    while ((match = imageTagRegex.exec(html)) !== null) {
      const srcUrl = match[1]
      // CloudFront URL から imageId を抽出
      const idMatch = srcUrl.match(/\/spec\/\d+\/([a-zA-Z0-9_-]+)\.jpg/)
      if (idMatch && idMatch[1]) {
        const imageId = idMatch[1]
        if (!seenIds.has(imageId)) {
          imageIds.push(imageId)
          seenIds.add(imageId)
        }
      }
    }

    return imageIds
  } catch (error) {
    console.error('Error scraping card images:', error)
    return []
  }
}

export async function fetchAndSaveCardImages(specId: number): Promise<string[]> {
  try {
    const cookieHeader = await getCookieHeader()
    const imageIds = await scrapeCardImages(specId, cookieHeader)

    if (imageIds.length > 0) {
      const { error } = await supabase
        .from('psa_cards')
        .update({ image_urls: imageIds })
        .eq('psa_spec_id', specId)

      if (error) {
        console.error('Failed to save images:', error)
      }
    }

    return imageIds
  } catch (error) {
    console.error('Error fetching and saving card images:', error)
    return []
  }
}

interface PriceMetrics {
  quantity: number
  averagePrice: number
}

async function fetchPSAPrices(specId: number, cookieHeader: string, grade: 10 | 9): Promise<PriceMetrics | null> {
  try {
    console.log(`[fetchPSAPrices] Fetching PSA${grade} prices for specId=${specId}`)
    const url = `https://www.psacard.com/api/psa/researchJourney/spec/${specId}/psa/priceSummary?g=${grade}&tr=6&salesSummaryType=TIMESERIES&q=false&gt=SINGLE_GRADED`
    console.log(`[fetchPSAPrices] URL: ${url}`)

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'accept-language': 'ja;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'cookie': cookieHeader,
      }
    })

    console.log(`[fetchPSAPrices] Response status: ${response.status}`)
    if (!response.ok) {
      console.log(`[fetchPSAPrices] Response not ok, returning null`)
      return null
    }

    const data = await response.json()
    console.log(`[fetchPSAPrices] Response data received, processing...`)
    const salesSummary = data.salesSummary || []

    let totalQty = 0
    let totalPrice = 0
    let daysWithSales = 0

    // 直近3日のデータを集計（quantity > 0 のみ）
    const recentDays = salesSummary.slice(-3)
    console.log(`[fetchPSAPrices] Checking last 3 days for sales data`)

    for (const day of recentDays) {
      const qty = day.metrics?.quantity || 0
      const avgPrice = day.metrics?.averagePrice || 0
      if (qty > 0) {
        totalQty += qty
        totalPrice += avgPrice * qty
        daysWithSales += 1
        console.log(`[fetchPSAPrices] ${day.date}: qty=${qty}, avgPrice=${avgPrice}`)
      }
    }

    console.log(`[fetchPSAPrices] totalQty=${totalQty}, totalPrice=${totalPrice}, daysWithSales=${daysWithSales}`)

    if (totalQty === 0) {
      console.log(`[fetchPSAPrices] No sales data in last 3 days, returning null`)
      return null
    }

    return {
      quantity: totalQty,
      averagePrice: Math.round(totalPrice / totalQty),
    }
  } catch (error) {
    console.error(`[fetchPSAPrices] Error fetching PSA${grade} prices for ${specId}:`, error)
    return null
  }
}

async function searchSnidanProduct(setCode: string, cardNumber: string): Promise<string | null> {
  try {
    // Get card name for more accurate search
    const { data: card } = await supabase
      .from('psa_cards')
      .select('card_name')
      .eq('set_id', setCode)
      .order('card_number')
      .limit(1)
      .single()

    // Search by card name + card number for better accuracy
    let cardName = card?.card_name || setCode
    // Remove variant suffixes for better search
    cardName = cardName
      .replace(/-Holo\b/g, '')
      .replace(/-Hyper\b/g, '')
      .replace(/-Reverse Foil\b/g, '')
      .replace(/Full Art\//g, '')
      .trim()
    const searchQuery = `${cardName} ${cardNumber.padStart(3, '0')}`
    const searchUrl = `https://snkrdunk.com/search?keywords=${encodeURIComponent(searchQuery)}&searchCategoryIds=6%2F33&brandIds=pokemon&sort=price_low&itemSizes=quantity_1&isSaleOnly=true&page=1`

    const response = await fetch(searchUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      }
    })

    if (!response.ok) return null

    const html = await response.text()

    // Extract links to apparels pages
    // Looking for patterns like: /apparels/{id} or href="/apparels/{id}"
    const apparelRegex = /\/apparels\/(\d+)/g
    let match
    const seenIds = new Set<string>()
    let validCount = 0

    while ((match = apparelRegex.exec(html)) !== null) {
      const apparelId = match[1]
      if (!seenIds.has(apparelId)) {
        // Check if this URL should be excluded (contains "used")
        const startIdx = Math.max(0, match.index - 100)
        const context = html.substring(startIdx, match.index + 50)

        if (!context.toLowerCase().includes('used')) {
          validCount++
          // Skip if multiple valid results (ambiguous)
          if (validCount > 1) {
            return null
          }
          seenIds.add(apparelId)
        }
      }
    }

    // If we found exactly one valid apparel ID, try to get the Japanese name
    if (seenIds.size === 1) {
      const apparelId = Array.from(seenIds)[0]
      const apparelPageUrl = `https://snkrdunk.com/apparels/${apparelId}`

      try {
        const pageResponse = await fetch(apparelPageUrl, {
          headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          }
        })

        if (pageResponse.ok) {
          const pageHtml = await pageResponse.text()
          const titleMatch = pageHtml.match(/<title>([^<]+)<\/title>/)
          if (titleMatch) {
            const titleText = titleMatch[1]
            const japaneseNameRaw = titleText.split('[')[0].trim()
            if (japaneseNameRaw) {
              return apparelId
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching apparel page for ${apparelId}:`, error)
      }

      return apparelId
    }

    return null
  } catch (error) {
    console.error(`Error searching Snidan for ${setCode} ${cardNumber}:`, error)
    return null
  }
}

async function fetchSnidanPrices(apparelId: string, grade: 10 | 9): Promise<PriceMetrics | null> {
  try {
    const conditionId = grade === 10 ? CONDITION_PSA10 : CONDITION_PSA9
    console.log(`[fetchSnidanPrices] Fetching for apparelId=${apparelId}, grade=${grade}, conditionId=${conditionId}`)
    const records = await getSalesHistory(parseInt(apparelId), conditionId)
    console.log(`[fetchSnidanPrices] Got ${records.length} total records`)

    // 直近3日（72時間以内）の成約レコードを抽出
    const recentRecords = records.filter(r => r.hoursAgo <= 72)
    console.log(`[fetchSnidanPrices] Filtered to ${recentRecords.length} records within 72 hours`)

    if (recentRecords.length === 0) {
      console.log(`[fetchSnidanPrices] No recent records, returning null`)
      return null
    }

    const totalPrice = recentRecords.reduce((sum, r) => sum + r.price, 0)
    const result = {
      quantity: recentRecords.length,
      averagePrice: Math.round(totalPrice / recentRecords.length),
    }
    console.log(`[fetchSnidanPrices] Result: qty=${result.quantity}, avgPrice=${result.averagePrice}`)
    return result
  } catch (error) {
    console.error(`[fetchSnidanPrices] Error for ${apparelId}:`, error)
    return null
  }
}

export async function fetchAndSaveCardPrices(specId: number): Promise<boolean> {
  try {
    // Get card details
    const { data: card, error: cardError } = await supabase
      .from('psa_cards')
      .select('psa_spec_id, card_number, set_id, snidan_apparel_id')
      .eq('psa_spec_id', specId)
      .single()

    if (cardError || !card) {
      console.log(`[fetchAndSaveCardPrices] Card not found: ${specId}`)
      return false
    }

    // Get set details for set_code
    const { data: set, error: setError } = await supabase
      .from('psa_sets')
      .select('set_code')
      .eq('psa_spec_id', card.set_id)
      .single()

    if (setError || !set) {
      console.log(`[fetchAndSaveCardPrices] Set not found for set_id: ${card.set_id}`)
      return false
    }

    console.log(`[fetchAndSaveCardPrices] Fetching prices for specId=${specId}`)

    const cookieHeader = await getCookieHeader()

    // Fetch PSA prices (in USD)
    const psa10Prices = await fetchPSAPrices(specId, cookieHeader, 10)
    const psa9Prices = await fetchPSAPrices(specId, cookieHeader, 9)

    console.log(`[fetchAndSaveCardPrices] PSA prices (USD): psa10=${psa10Prices?.averagePrice}, psa9=${psa9Prices?.averagePrice}`)

    // Search and link Snidan
    let snidanApparel = card.snidan_apparel_id
    let snidan10Prices = null
    let snidan9Prices = null

    if (!snidanApparel) {
      snidanApparel = await searchSnidanProduct(set.set_code, card.card_number)
    }

    if (snidanApparel) {
      snidan10Prices = await fetchSnidanPrices(snidanApparel, 10)
      snidan9Prices = await fetchSnidanPrices(snidanApparel, 9)
    }

    // Save to database (USD prices)
    const updateData: any = {
      price_data_updated_at: new Date().toISOString(),
    }

    if (psa10Prices) {
      updateData.psa_psa10_qty_3d = psa10Prices.quantity
      updateData.psa_psa10_avg_price_3d = psa10Prices.averagePrice
    }

    if (psa9Prices) {
      updateData.psa_psa9_qty_3d = psa9Prices.quantity
      updateData.psa_psa9_avg_price_3d = psa9Prices.averagePrice
    }

    if (snidanApparel) {
      updateData.snidan_apparel_id = snidanApparel
    }

    if (snidan10Prices) {
      updateData.snidan_psa10_qty_3d = snidan10Prices.quantity
      updateData.snidan_psa10_avg_price_3d = snidan10Prices.averagePrice
    }

    if (snidan9Prices) {
      updateData.snidan_psa9_qty_3d = snidan9Prices.quantity
      updateData.snidan_psa9_avg_price_3d = snidan9Prices.averagePrice
    }

    const { error: updateError } = await supabase
      .from('psa_cards')
      .update(updateData)
      .eq('psa_spec_id', specId)

    return !updateError
  } catch (error) {
    console.error('Error fetching and saving card prices:', error)
    return false
  }
}
