import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { psa_spec_id, set_code } = await request.json()

    if (!psa_spec_id || !set_code) {
      return Response.json(
        { error: 'psa_spec_id and set_code are required' },
        { status: 400 }
      )
    }

    // psa_cards を検索して set_id を取得
    const { data: card, error: searchError } = await supabase
      .from('psa_cards')
      .select('set_id')
      .eq('psa_spec_id', psa_spec_id)
      .single()

    if (searchError || !card) {
      return Response.json(
        { error: `Card with spec ID ${psa_spec_id} not found` },
        { status: 404 }
      )
    }

    // psa_sets の set_code を更新
    const { error: updateError } = await supabase
      .from('psa_sets')
      .update({ set_code })
      .eq('psa_spec_id', card.set_id)

    if (updateError) {
      return Response.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      message: 'Set code updated successfully',
    })
  } catch (error) {
    console.error('[Update Set Code] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
