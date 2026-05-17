import { createClient } from '@supabase/supabase-js'
import { fetchAndSaveCardPrices } from '@/app/actions/psa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { specId, url } = await request.json()

    if (!specId || !url) {
      return Response.json({ error: 'specId and url are required' }, { status: 400 })
    }

    // Extract apparel ID from URL
    // Format: https://snkrdunk.com/apparels/{id}
    const match = url.match(/\/apparels\/(\d+)/)
    if (!match) {
      return Response.json({ error: 'Invalid Snidan URL format' }, { status: 400 })
    }

    const apparelId = match[1]

    // Fetch Japanese name, snidan_code and image from Snidan page
    let japaneseNameJa = null
    let snidanCode = null
    let snidanImageUrl = null
    try {
      const apparelPageUrl = `https://snkrdunk.com/apparels/${apparelId}`
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
          japaneseNameJa = titleText.split('[')[0].trim()

          // Extract snidan_code from [S8a-G 001/015]
          const codeMatch = titleText.match(/\[(.*?)\]/)
          if (codeMatch) {
            snidanCode = codeMatch[1]
          }
        }

        const ogImageMatch = pageHtml.match(/<meta property="og:image" content="([^"]+)">/)
        if (ogImageMatch) {
          snidanImageUrl = ogImageMatch[1]
        }
      }
    } catch (error) {
      console.error('Error fetching Snidan page:', error)
    }

    // Get current card to check if image_urls is empty
    const { data: currentCard } = await supabase
      .from('psa_cards')
      .select('image_urls')
      .eq('psa_spec_id', specId)
      .single()

    // Save apparel ID, Japanese name, snidan_code, and image (if missing) to DB
    const updateData: any = { snidan_apparel_id: apparelId }
    if (japaneseNameJa) {
      updateData.card_name_ja = japaneseNameJa
    }
    if (snidanCode) {
      updateData.snidan_code = snidanCode
    }
    if (snidanImageUrl && (!currentCard?.image_urls || currentCard.image_urls.length === 0)) {
      updateData.image_urls = [snidanImageUrl]
    }

    const { error: updateError } = await supabase
      .from('psa_cards')
      .update(updateData)
      .eq('psa_spec_id', specId)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    // Fetch updated card data
    const { data: card, error: fetchError } = await supabase
      .from('psa_cards')
      .select('snidan_apparel_id, snidan_psa10_avg_price_3d, snidan_psa9_avg_price_3d, card_name_ja, snidan_code, image_urls')
      .eq('psa_spec_id', specId)
      .single()

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 })
    }

    return Response.json({
      success: true,
      snidan_apparel_id: card.snidan_apparel_id,
      snidan_psa10_avg_price_3d: card.snidan_psa10_avg_price_3d,
      snidan_psa9_avg_price_3d: card.snidan_psa9_avg_price_3d,
      card_name_ja: card.card_name_ja,
      snidan_code: card.snidan_code,
      image_urls: card.image_urls,
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
