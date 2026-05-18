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

    // psa_sets を検索
    const { data: set, error: searchError } = await supabase
      .from('psa_sets')
      .select('psa_spec_id')
      .eq('psa_spec_id', psa_spec_id)
      .single()

    if (searchError || !set) {
      return Response.json(
        { error: `Set with spec ID ${psa_spec_id} not found` },
        { status: 404 }
      )
    }

    // set_code を更新
    const { error: updateError } = await supabase
      .from('psa_sets')
      .update({ set_code })
      .eq('psa_spec_id', psa_spec_id)

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
