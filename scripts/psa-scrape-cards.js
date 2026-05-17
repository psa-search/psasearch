require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase から最新のクッキーを取得
async function getCookieHeader() {
  const { data, error } = await supabase
    .from('cf_clearance_cookies')
    .select('cookies')
    .order('obtained_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Failed to fetch cookies from Supabase:', error.message)
    process.exit(1)
  }

  if (!data || !data.cookies) {
    console.error('No cookies found in Supabase')
    process.exit(1)
  }

  return data.cookies
}

const CATEGORY_ID = 156940 // Pokemon
const API_URL = 'https://www.psacard.com/Pop/GetSetItems'

async function scrapeCardsForSet(specId, setName, cookieHeader) {
  try {
    const body = new URLSearchParams({
      draw: 1,
      start: 0,
      length: 1000,
      search: '',
      headingID: specId,
      categoryID: CATEGORY_ID,
      isPSADNA: false,
    })

    const response = await fetch(API_URL, {
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
      console.warn(`  ✗ HTTP ${response.status}`)
      return []
    }

    const data = await response.json()
    const cards = []

    if (!data.data || !Array.isArray(data.data)) {
      return cards
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
        image_url: null,
      })
    }

    return cards
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`)
    return []
  }
}

async function main() {
  try {
    // Supabase から最新のクッキーを取得
    console.log('Fetching cookies from Supabase...')
    const cookieHeader = await getCookieHeader()
    console.log('✓ Cookies obtained\n')

    // psa_sets から全セットを取得
    const { data: sets, error: setsError } = await supabase
      .from('psa_sets')
      .select('psa_spec_id, set_name')
      .order('psa_spec_id', { ascending: false })
      .limit(100) // テスト用に最初は100件

    if (setsError) {
      console.error('Error fetching sets:', setsError.message)
      process.exit(1)
    }

    console.log(`Processing ${sets.length} sets...\n`)

    let totalCards = 0

    for (const set of sets) {
      process.stdout.write(`Fetching cards for set ${set.psa_spec_id} (${set.set_name})... `)

      const cards = await scrapeCardsForSet(set.psa_spec_id, set.set_name, cookieHeader)

      if (cards.length === 0) {
        console.log('no cards')
        continue
      }

      // DB に保存
      const { error: insertError } = await supabase
        .from('psa_cards')
        .upsert(cards, { onConflict: 'psa_spec_id' })

      if (insertError) {
        console.log(`error: ${insertError.message}`)
        continue
      }

      totalCards += cards.length
      console.log(`✓ ${cards.length} cards`)

      // レート制限対策
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log(`\n✓ Successfully scraped and saved ${totalCards} cards`)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
