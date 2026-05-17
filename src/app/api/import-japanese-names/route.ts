import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    // Read NDJSON file and build name map
    const nameMap = new Map<string, string>()
    let lineCount = 0
    let parseErrorCount = 0

    const readlineInterface = createInterface({
      input: createReadStream('/Users/okawa/works/みんトレ/data/output/cards_detail_fixed.ndjson'),
      crlfDelay: Infinity,
    })

    for await (const line of readlineInterface) {
      if (!line.trim()) continue

      try {
        const data = JSON.parse(line)
        const nameEn = data.name_en
        const nameJa = data.name_ja

        if (nameEn && nameJa) {
          if (!nameMap.has(nameEn)) {
            nameMap.set(nameEn, nameJa)
            lineCount++
          }
        }
      } catch (error) {
        parseErrorCount++
      }
    }

    console.log(`Loaded ${lineCount} unique card names, ${parseErrorCount} parse errors`)

    // Get all cards with missing Japanese names
    const { data: allCards, error: fetchError } = await supabase
      .from('psa_cards')
      .select('psa_spec_id, card_name, card_name_ja')
      .is('card_name_ja', null)

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 })
    }

    console.log(`Found ${allCards.length} cards with missing Japanese names`)

    // Get all cards with pagination
    let allCardsToProcess: any[] = allCards
    let offset = 1000

    while (true) {
      const { data: moreCards, error: moreError } = await supabase
        .from('psa_cards')
        .select('psa_spec_id, card_name, card_name_ja')
        .is('card_name_ja', null)
        .range(offset, offset + 999)

      if (moreError || !moreCards || moreCards.length === 0) {
        break
      }

      allCardsToProcess = allCardsToProcess.concat(moreCards)
      offset += 1000
    }

    console.log(`Total cards to process: ${allCardsToProcess.length}`)

    // Find matching cards
    const cardsToUpdate = []
    const sampleMatches = []

    for (const card of allCardsToProcess) {
      const japaneseNameFromMap = nameMap.get(card.card_name)
      if (japaneseNameFromMap) {
        cardsToUpdate.push({
          psa_spec_id: card.psa_spec_id,
          card_name_ja: japaneseNameFromMap,
        })
        if (sampleMatches.length < 10) {
          sampleMatches.push({
            card_name: card.card_name,
            card_name_ja: japaneseNameFromMap,
          })
        }
      }
    }

    console.log(`Found ${cardsToUpdate.length} cards to update`)
    console.log('Sample matches:', sampleMatches)

    // Update in batches
    let updated = 0
    const batchSize = 50

    for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
      const batch = cardsToUpdate.slice(i, i + batchSize)

      const updatePromises = batch.map((card: any) =>
        supabase
          .from('psa_cards')
          .update({ card_name_ja: card.card_name_ja })
          .eq('psa_spec_id', card.psa_spec_id)
      )

      const results = await Promise.all(updatePromises)
      const successCount = results.filter(r => !r.error).length
      updated += successCount
    }

    revalidatePath('/api/cards')
    revalidatePath('/cards-list')

    return Response.json({
      success: true,
      loaded: lineCount,
      totalCards: allCards.length,
      matched: cardsToUpdate.length,
      updated,
      sampleMatches,
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
