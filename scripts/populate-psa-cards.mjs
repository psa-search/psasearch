/**
 * PSA カードデータを psacard.com API から取得して Supabase に保存
 *
 * 使い方:
 *   node scripts/populate-psa-cards.mjs <setId> <setName> [year] [--max-pages N]
 *
 * 例:
 *   node scripts/populate-psa-cards.mjs 323965 "2025 Pokemon Japanese M2a" 2025
 *   node scripts/populate-psa-cards.mjs 323965 "2025 Pokemon Japanese M2a" 2025 --max-pages 1
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local from project root
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function fetchSetCards(setId, page = 1) {
  const url = `https://www.psacard.com/api/psa/auctionprices/set/${setId}/tableData?g=all&sort=CardNumber_ASC&q=&page=${page}`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`❌ Failed to fetch page ${page}:`, err.message)
    return null
  }
}

async function populatePsaCards(setId, setName, year = null, maxPages = null) {
  console.log(`📥 Fetching PSA cards for set: ${setName} (setId: ${setId})`)
  if (maxPages) console.log(`   (max ${maxPages} page(s))`)

  // PSA set を作成または確認
  const { data: existingSet } = await supabase
    .from('psa_sets')
    .select('set_id')
    .eq('set_id', setId)
    .single()

  if (!existingSet) {
    const { error: setError } = await supabase.from('psa_sets').insert([
      { set_id: setId, set_name: setName, year: year ? parseInt(year) : null },
    ])
    if (setError) {
      console.error('❌ Error creating PSA set:', setError.message)
      return
    }
    console.log(`✓ Created PSA set: ${setName}`)
  }

  let allCards = []
  let page = 1
  let totalItems = 0
  let processed = 0

  while (true) {
    const data = await fetchSetCards(setId, page)
    if (!data?.setItems?.setItems) {
      if (page === 1) {
        console.error('❌ No data returned from API')
        return
      }
      break
    }

    const { setItems, totalItems: total } = data.setItems
    if (page === 1) totalItems = total

    setItems.forEach(item => {
      allCards.push({
        spec_id: String(item.specId),
        card_name: item.collectibleSubject,
        card_number: item.setNumber,
        psa_set_id: setId,
      })
    })

    processed += setItems.length
    console.log(`✓ Page ${page}: ${setItems.length} cards (${processed}/${totalItems})`)

    if (processed >= totalItems || (maxPages && page >= maxPages)) break
    page++
  }

  if (allCards.length === 0) {
    console.log('❌ No cards found')
    return
  }

  console.log(`\n💾 Saving ${allCards.length} cards to Supabase...`)

  // 100件ずつ分割して挿入（API制限回避）
  const batchSize = 100
  for (let i = 0; i < allCards.length; i += batchSize) {
    const batch = allCards.slice(i, i + batchSize)
    const { error } = await supabase.from('psa_cards').insert(batch)

    if (error) {
      if (error.code === '23505') {
        // Duplicate key - some cards already exist, continue
        console.log(`⚠️  Batch ${Math.floor(i / batchSize) + 1}: Some cards already exist, skipping duplicates`)
      } else {
        console.error(`❌ Error inserting batch:`, error.message)
        return
      }
    } else {
      console.log(`✓ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} cards saved`)
    }
  }

  console.log(`✅ Successfully populated ${allCards.length} PSA cards`)
}

// Main
const setId = process.argv[2]
const setName = process.argv[3]
const year = process.argv[4]
const maxPagesIdx = process.argv.indexOf('--max-pages')
const maxPages = maxPagesIdx !== -1 ? parseInt(process.argv[maxPagesIdx + 1]) : null

if (!setId || !setName) {
  console.log('使い方: node scripts/populate-psa-cards.mjs <setId> <setName> [year] [--max-pages N]')
  console.log('例: node scripts/populate-psa-cards.mjs 323965 "2025 Pokemon Japanese M2a" 2025')
  console.log('     node scripts/populate-psa-cards.mjs 323965 "2025 Pokemon Japanese M2a" 2025 --max-pages 1')
  process.exit(1)
}

await populatePsaCards(setId, setName, year, maxPages)
