import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { apparelId, specId } = await request.json()

    if (!apparelId || !specId) {
      return Response.json(
        { success: false, error: 'apparelId and specId are required' },
        { status: 400 }
      )
    }

    // psa_cards の存在確認
    const { data: card, error: cardError } = await supabase
      .from('psa_cards')
      .select('psa_spec_id')
      .eq('psa_spec_id', specId)
      .single()

    if (cardError || !card) {
      return Response.json(
        { success: false, error: 'PSA card not found' },
        { status: 404 }
      )
    }

    // snidan_cards を更新
    const { error: snidanError } = await supabase
      .from('snidan_cards')
      .update({ psa_spec_id: specId })
      .eq('snidan_apparel_id', apparelId)

    if (snidanError) {
      throw new Error(snidanError.message)
    }

    // psa_cards も更新
    const { error: psaError } = await supabase
      .from('psa_cards')
      .update({ snidan_apparel_id: apparelId })
      .eq('psa_spec_id', specId)

    if (psaError) {
      throw new Error(psaError.message)
    }

    return Response.json({
      success: true,
    })
  } catch (error) {
    console.error('[Snidan Cards Link API] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
