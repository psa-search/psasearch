import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { specId, snidanId } = await request.json()

    if (!specId || !snidanId) {
      return Response.json(
        { error: 'specId and snidanId are required' },
        { status: 400 }
      )
    }

    // psa_cards を検索
    const { data: card, error: searchError } = await supabase
      .from('psa_cards')
      .select('psa_spec_id')
      .eq('psa_spec_id', specId)
      .single()

    if (searchError || !card) {
      return Response.json(
        { error: `Card with spec ID ${specId} not found` },
        { status: 404 }
      )
    }

    // snidan_apparel_id を更新
    const { error: updateError } = await supabase
      .from('psa_cards')
      .update({ snidan_apparel_id: snidanId })
      .eq('psa_spec_id', specId)

    if (updateError) {
      return Response.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      message: 'Card linked successfully',
    })
  } catch (error) {
    console.error('[Snidan Link Card] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
