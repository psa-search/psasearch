/**
 * PSA specId検索スクリプト
 * スニダンのname/productNumberからPSAのspecIdを取得してマッピングを保存
 *
 * 使い方:
 *   node scripts/psa-search.mjs <snidanId> "<cardName>" "<productNumber>"
 *
 * 例:
 *   node scripts/psa-search.mjs 722239 "MEGA Charizard X ex MA [M2a 223/193]" "pkmn-tcg-M2a-223"
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const MAPPING_FILE = new URL('../src/lib/psa-mapping.json', import.meta.url).pathname

/**
 * スニダンのname/productNumberから検索クエリを組み立て
 * "MEGA Charizard X ex MA [M2a 223/193]..." + "pkmn-tcg-M2a-223"
 * → "Pokemon Japanese MEGA Charizard X ex MA M2a 223"
 */
function buildSearchQuery(name, productNumber) {
  // nameの[より前を取得してトリム
  const cardName = name.split('[')[0].trim()

  // productNumberから識別子と番号を取得 (pkmn-tcg-M2a-223 → M2a 223)
  const parts = productNumber.replace('pkmn-tcg-', '').split('-')
  // 最後の数字部分がカード番号、それ以前がセット識別子
  const cardNum = parts[parts.length - 1]
  const setCode = parts.slice(0, -1).join('-')

  return `Pokemon Japanese ${cardName} ${setCode} ${cardNum}`
}

async function searchPsaSpecId(snidanId, cardName, productNumber) {
  const query = buildSearchQuery(cardName, productNumber)
  console.log(`検索クエリ: "${query}"`)

  const url = `https://www.collectorsuniverse.com/specsearch/search/psaformatted?callback=cb&term=${encodeURIComponent(query)}&includePopOnly=true&mandatoryAdditionalTerms=%2Bsport%3Atcg%20cards&_=${Date.now()}`

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    locale: 'ja-JP',
  })
  const page = await context.newPage()

  let results = []
  try {
    // まずpsacard.comにアクセスしてCookieを取得
    await page.goto('https://www.psacard.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // 直接APIを叩く
    const response = await page.evaluate(async (apiUrl) => {
      const res = await fetch(apiUrl, {
        headers: {
          'accept': '*/*',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'cross-site',
          'referer': 'https://www.psacard.com/',
        }
      })
      return res.text()
    }, url)

    // JSONP形式 cb([...]) をパース
    const jsonStr = response.replace(/^cb\(/, '').replace(/\);?\s*$/, '')
    results = JSON.parse(jsonStr)

    console.log(`\n検索結果 ${results.length}件:`)
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.specid}] ${r.description} (score: ${r.score})`)
    })

    // "Pokemon Japanese" を含む結果を優先、変種（Incorrect/Missing Texture等）は後回し
    const VARIANT_PATTERN = /incorrect|missing|error|variant|misprint/i
    const japanese = results.filter(r =>
      r.description.toLowerCase().includes('pokemon japanese')
    )
    const standard = japanese.filter(r => !VARIANT_PATTERN.test(r.description))

    const best = standard[0] ?? japanese[0] ?? results[0]
    if (best) {
      console.log(`\n→ 採用: [${best.specid}] ${best.description}`)
      return { specid: best.specid, description: best.description, query, results: results.slice(0, 5) }
    }
  } catch (e) {
    console.error('エラー:', e.message)
  } finally {
    await browser.close()
  }
  return null
}

async function saveMapping(snidanId, specId, description, query) {
  let mapping = {}
  if (existsSync(MAPPING_FILE)) {
    mapping = JSON.parse(readFileSync(MAPPING_FILE, 'utf-8'))
  }

  mapping[String(snidanId)] = {
    specId,
    description,
    query,
    updatedAt: new Date().toISOString(),
  }

  writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2))
  console.log(`\nマッピング保存: ${MAPPING_FILE}`)
}

// CLI実行
const [,, snidanId, cardName, productNumber] = process.argv
if (!snidanId || !cardName || !productNumber) {
  console.error('Usage: node scripts/psa-search.mjs <snidanId> "<cardName>" "<productNumber>"')
  process.exit(1)
}

const result = await searchPsaSpecId(snidanId, cardName, productNumber)
if (result) {
  await saveMapping(snidanId, result.specid, result.description, result.query)
  console.log('\n完了！')
} else {
  console.log('specIdが見つかりませんでした')
}
