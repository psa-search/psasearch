const cheerio = require('cheerio')

async function testPsaScrape() {
  try {
    console.log('Fetching PSA Card 2026 page...')

    const url = 'https://www.psacard.com/pop/tcg-cards/2026/326969'
    const cfClearance = process.env.CF_CLEARANCE || '3mr7IO7mdp8Snh52S19dIQiidD2qodBbCDl3NV0698E-1778917820-1.2.1.1-2v2e2KpAah53vJm.7_81giUolw23rHO0XPuOmn8az26sJ_kTvNUSlL6I0CTB3RvDhrFo_SeROMKhzxkhYR6iFDAUdVgPqOJxXxwzlV1TCyrto.cz1DT.fHBoI8MMWfKGHYxYYUPGcBzi1xyhQ8fVAstT6.BnXcRTX.uUj6msHV4ObGn9aF5GrZ.oa.t7TwFBqAKephAiCpaKmk9qQ4Bjwqi3YNWhYc1ROme1PHXm3xRFsvUO9ZLnejLKJ87Q1nABR8VctoLpAC39.6ppgvg5JodVIx65iCqWt.34chjbUWH1hgq_bXZv29XT8udnR7lhAPSsUaQ12qpJOB_QuF0zOf0C5ar2xRaRdQ600_.uqT3VEgLB5ZCuvrznOvijKFw6ACq3PpfQOXFDwoU21QTgtcGhzZbbrlg3AV9i1VqHlJc'

    const cookies = `psa-locale=ja-JP; env=prod; ASP.NET_SessionId=4dvdt22iug5eosfl323ex5pi; isListView=undefined; cf_clearance=${cfClearance}; AWSALBTG=7u9Iv6WimkQh/Tv+j2rgZSezVWzpqiSTszYD3J/epxRKwyV9hJMTCw3uTV1Ky0TKDNAXgUUfuy+tgTFOLGSQ4FGTHHnHUx/hLB38G3Do4coH1J0sb67K0jL9nTqmgV6mmzhpqxTsXu2SY6oFYP2xdLbW2YbOYz90jxgOlDNsB9C; AWSALB=kMzH8pFSTJtdMGefxotKOYc2nCGI3oHSZlB8VWUx7RMpiv7V73gJmPr0Wsf/+RA3eLkaHDoIZ0R6E3s60uvZAm8aTVX3Uiw07dSLsvwF5lZEtctYbeCZ8WG9EVIm; __cf_bm=jBinUbwmPIZd2Beu1M20ljzjBuKi57UEqyS3cMzZwfs-1778917836.0090349-1.0.1.1-GrkYrNPa3joues01KTEYjMIh1ZGJw9RFoTi9WB3WrytFg_jorKvdI5TxFZznNBfdcKz.OeMsXyvgFGox5oQS.UWr54g.pGMnNfOzZ0B0DriFgryfDYBKI6jtuQdTXVmZJIUGEORxiSknNxUAU.7Jyg`

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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('✓ Successfully fetched page')
    console.log(`Response length: ${html.length} bytes`)

    const $ = cheerio.load(html)

    // Pokemon Japanese で始まるリンクを取得
    const sets = []
    $('a[href*="/pop/tcg-cards/2026/pokemon-japanese"]').each((_, el) => {
      const href = $(el).attr('href')
      const text = $(el).text().trim()

      if (href && text) {
        sets.push({
          href,
          name: text
        })
      }
    })

    console.log(`\n✓ Found ${sets.length} Pokemon Japanese sets:`)
    sets.forEach((set, i) => {
      console.log(`  ${i + 1}. ${set.name}`)
      console.log(`     URL: https://www.psacard.com${set.href}`)
    })

    return sets
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

testPsaScrape()
