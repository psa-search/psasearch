const { createClient } = require('@supabase/supabase-js')
const cheerio = require('cheerio')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const cfClearance = process.env.CF_CLEARANCE

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

if (!cfClearance) {
  console.error('Missing CF_CLEARANCE environment variable')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function scrapeSetsByYear(year, setId) {
  try {
    const url = `https://www.psacard.com/pop/tcg-cards/${year}/${setId}`

    console.log(`Fetching ${year} page (${url})...`)

    const cookies = `psa-locale=ja-JP; env=prod; psa-apr-recentsearch=%7B%22recentSearches%22%3A%5B%7B%22searchId%22%3A%220-Pokemon-Japanese%20s8a%20001%22%2C%22catId%22%3A%220%22%2C%22catName%22%3A%22%22%2C%22search%22%3A%22Pokemon%20Japanese%20s8a%20001%22%7D%5D%7D; ASP.NET_SessionId=4dvdt22iug5eosfl323ex5pi; isListView=undefined; cf_clearance=${cfClearance}; AWSALBTG=A+Ipy/WCcwAxJDEzZMqD78ztMVbZNzpCni2vHzG4kcC9FDebp1rHqtwEdfvh05GrwgbukuHufMeU91h2yYr+BNkcwYB0fU1EueiJPPJdcujm/WSzh+SMLciLi777f9b4xhe7DnquWZZOo4pYAlWJL43paWtS/GezFDlTZqbesl3t; AWSALB=AeTxVe1IHk3QnbMQMCs/LrZ8WCMIeqw2awcbt84qj/Xd7eQUZIfVNNjTQbjEpUNRZXznRmJRtTQTTPRvDT/58PrCUUCF6wp/5y85E5MqRS1/zd8oRNljyXQNR5+q; __cf_bm=1QfmHLgQ7Iuc9Cvxaq710eaSE9hTi9xv1t8iAe4h83c-1778918911.5980773-1.0.1.1-hVoGiTJB7a7ZNIYIp3DU46zYzktiU69AGcsYDchf7wTQzO3nPP0873EX7hNDnC8SmjKZiYoAGK7r3mkLzSHPMFX7WahkljKzlk8moRmez907b0tCFZErT9Ya6xN_akI3Jt5UJD9pTAXWAt7hvjvoew`

    const response = await fetch(url, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'ja;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'cookie': cookies,
      }
    })

    if (!response.ok) {
      console.warn(`  ✗ HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const sets = []
    $('a[href*="/pop/tcg-cards/"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const text = $(el).text().trim()

      // 年度ページのセットリンク：/pop/tcg-cards/{year}/pokemon-japanese-.../{setId}
      const match = href.match(new RegExp(`/pop/tcg-cards/${year}/(pokemon-japanese-[^/]+)/(\\d+)$`))
      if (!match) return

      const setSlug = match[1]
      const specId = parseInt(match[2])

      // 重複排除（同じ psa_spec_id は1度だけ保存）
      if (!sets.find((s) => s.psa_spec_id === specId)) {
        sets.push({
          year,
          set_id: setId,
          set_name: text,
          set_slug: setSlug,
          psa_spec_id: specId,
        })
      }
    })

    console.log(`  ✓ Found ${sets.length} sets`)
    sets.forEach((set) => {
      console.log(`    - ${set.set_name} (spec_id: ${set.psa_spec_id})`)
    })
    return sets
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`)
    return []
  }
}

async function main() {
  try {
    // 全年度を取得（または引数で指定した年度）
    let query = supabase
      .from('psa_years')
      .select('year, set_id')
      .order('year', { ascending: false })

    if (process.argv[2]) {
      const targetYear = parseInt(process.argv[2])
      query = query.eq('year', targetYear)
    }

    const { data: years, error: yearsError } = await query

    if (yearsError) {
      console.error('Error fetching years:', yearsError.message)
      process.exit(1)
    }

    if (years.length === 0) {
      console.error('No years found')
      process.exit(1)
    }

    console.log(`Processing ${years.length} years...\n`)

    let totalSets = 0

    // 指定年度のセット情報を取得
    for (const { year, set_id } of years) {
      // 既存データを削除
      await supabase
        .from('psa_sets')
        .delete()
        .eq('year', year)

      const sets = await scrapeSetsByYear(year, set_id)

      if (sets.length === 0) continue

      // DB に保存
      const { error: insertError } = await supabase
        .from('psa_sets')
        .insert(sets)

      if (insertError) {
        console.error(`    Error saving sets: ${insertError.message}`)
        continue
      }

      totalSets += sets.length

      // レート制限対策
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    console.log(`\n✓ Successfully scraped and saved ${totalSets} sets`)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
