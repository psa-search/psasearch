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
    // Set code mapping: NDJSON code -> PSA code
    // Only include mappings that actually exist in PSA DB
    const setCodeMapping: Record<string, string> = {
      // M series
      "m1s": "m1s",
      "m1l": "m1l",
      "m2": "m2",
      "m2a": "m2a",
      "m3": "m3",
      "m4": "m4",
      // SV series (modern)
      "sv1v": "sv1v",
      "sv1a": "sv1a",
      "sv2d": "sv2d",
      "sv2p": "sv2p",
      "sv2a": "sv2a",
      "sv3": "sv3",
      "sv3a": "sv3a",
      "sv4m": "sv4m",
      "sv4k": "sv4k",
      "sv4a": "sv4a",
      "sv5m": "sv5m",
      "sv5k": "sv5k",
      "sv5a": "sv5a",
      "sv6": "sv6",
      "sv6a": "sv6a",
      "sv7": "sv7",
      "sv7a": "sv7a",
      "sv8": "sv8",
      "sv8a": "sv8a",
      "sv9": "sv9",
      "sv9a": "sv9a",
      "sv10": "sv10",
      "sv11w": "sv11w",
      "sv11b": "sv11b",
      // XY series
      "xy": "xy",
      // Other confirmed mappings
      "sun": "sun",
      "diamond": "diamond",
      "sword": "sword",
    }

    console.log(`Using ${Object.keys(setCodeMapping).length} set code mappings`)

    // Read NDJSON file and build image map by (expansion_id, card_number)
    const imageMap = new Map<string, string>() // key: "sv6|064", value: image_url
    let lineCount = 0

    const readlineInterface = createInterface({
      input: createReadStream('/Users/okawa/works/みんトレ/data/output/cards_detail_fixed.ndjson'),
      crlfDelay: Infinity,
    })

    for await (const line of readlineInterface) {
      if (!line.trim()) continue

      try {
        const data = JSON.parse(line)
        const expansionId = data.expansion_id
        const cardNumber = data.number
        const imageUrl = data.image_url

        if (expansionId && cardNumber !== undefined && imageUrl) {
          // Remove _ja suffix if present
          const ndJsonCode = expansionId.replace(/_ja$/, '')
          const psaCode = setCodeMapping[ndJsonCode]

          // Only process if we have a mapping for this set
          if (psaCode) {
            const key = `${psaCode}|${String(cardNumber).padStart(3, '0')}`

            if (!imageMap.has(key)) {
              imageMap.set(key, imageUrl)
              lineCount++
            }
          }
        }
      } catch (error) {
        // Skip invalid lines
      }
    }

    console.log(`Loaded ${lineCount} image URLs`)

    // Get all sets to map set_code to set_id
    const { data: allSets } = await supabase
      .from('psa_sets')
      .select('psa_spec_id, set_code')

    const setCodeToId = new Map<string, number>()
    if (allSets) {
      allSets.forEach(set => {
        if (set.set_code) {
          setCodeToId.set(set.set_code, set.psa_spec_id)
        }
      })
    }

    console.log(`Loaded ${setCodeToId.size} sets`)

    // Get all cards that either have no images or are missing images
    const { data: allCards } = await supabase
      .from('psa_cards')
      .select('psa_spec_id, set_id, card_number')
      .limit(100000)

    let matched = 0
    let updated = 0
    const sampleMatches = []
    const cardsToUpdate = []

    for (const card of allCards || []) {
      // Get set_code for this card
      const setId = card.set_id
      let setCode: string | undefined

      for (const [code, id] of setCodeToId) {
        if (id === setId) {
          setCode = code
          break
        }
      }

      if (!setCode) continue

      const cardNumberStr = String(card.card_number).padStart(3, '0')
      const key = `${setCode}|${cardNumberStr}`
      const imageUrl = imageMap.get(key)

      if (imageUrl) {
        matched++
        cardsToUpdate.push({
          psa_spec_id: card.psa_spec_id,
          imageUrl,
          card_number: card.card_number,
          set_code: setCode,
        })

        if (sampleMatches.length < 10) {
          sampleMatches.push({
            set_code: setCode,
            card_number: card.card_number,
            image_url: imageUrl,
          })
        }
      }
    }

    console.log(`Found ${matched} cards with matching images`)

    // Update in batches
    const batchSize = 50

    for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
      const batch = cardsToUpdate.slice(i, i + batchSize)

      const updatePromises = batch.map((card: any) =>
        supabase
          .from('psa_cards')
          .update({ image_urls: [card.imageUrl] })
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
      matched,
      updated,
      sampleMatches,
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
