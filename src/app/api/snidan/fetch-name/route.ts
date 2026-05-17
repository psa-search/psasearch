import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { apparelId, specId } = await request.json()

    if (!apparelId) {
      return Response.json({ error: 'apparelId is required' }, { status: 400 })
    }

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

    // If we have a specId, save to database
    if (specId) {
      // Get current card to check if image_urls is empty
      const { data: currentCard } = await supabase
        .from('psa_cards')
        .select('image_urls')
        .eq('psa_spec_id', specId)
        .single()

      const updateData: any = {}
      if (japaneseNameJa) {
        updateData.card_name_ja = japaneseNameJa
      }
      if (snidanCode) {
        updateData.snidan_code = snidanCode
      }
      if (snidanImageUrl && (!currentCard?.image_urls || currentCard.image_urls.length === 0)) {
        updateData.image_urls = [snidanImageUrl]
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('psa_cards')
          .update(updateData)
          .eq('psa_spec_id', specId)

        if (updateError) {
          console.error('Error updating card:', updateError)
        }
      }
    }

    return Response.json({
      success: true,
      card_name_ja: japaneseNameJa,
      snidan_code: snidanCode,
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
