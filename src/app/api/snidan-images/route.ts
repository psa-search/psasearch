import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { apparelIds } = await request.json()

    if (!apparelIds || !Array.isArray(apparelIds) || apparelIds.length === 0) {
      return Response.json({ error: 'apparelIds array is required' }, { status: 400 })
    }

    const results = []

    for (const apparelId of apparelIds) {
      try {
        // Fetch image from Snidan page
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
            const ogImageMatch = pageHtml.match(/<meta property="og:image" content="([^"]+)">/)
            if (ogImageMatch) {
              snidanImageUrl = ogImageMatch[1]
            }
          }
        } catch (error) {
          console.error(`Error fetching Snidan page for ${apparelId}:`, error)
        }

        if (!snidanImageUrl) {
          results.push({
            apparelId,
            success: false,
            error: 'Could not extract image from Snidan page'
          })
          continue
        }

        // Find card by snidan_apparel_id and update image
        const { data: card, error: fetchError } = await supabase
          .from('psa_cards')
          .select('psa_spec_id, image_urls')
          .eq('snidan_apparel_id', apparelId)
          .single()

        if (fetchError || !card) {
          results.push({
            apparelId,
            success: false,
            error: 'Card not found with this apparel ID'
          })
          continue
        }

        // Update image_urls (force update, not conditional)
        const { error: updateError } = await supabase
          .from('psa_cards')
          .update({ image_urls: [snidanImageUrl] })
          .eq('psa_spec_id', card.psa_spec_id)

        if (updateError) {
          results.push({
            apparelId,
            success: false,
            error: updateError.message
          })
          continue
        }

        results.push({
          apparelId,
          success: true,
          imageUrl: snidanImageUrl
        })
      } catch (error) {
        results.push({
          apparelId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return Response.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('[Snidan Images] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
