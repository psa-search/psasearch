import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params
    const specIdNum = parseInt(specId)

    const [setResult, cardsResult] = await Promise.all([
      supabase
        .from('psa_sets')
        .select('psa_spec_id, set_name, set_code, year')
        .eq('psa_spec_id', specIdNum)
        .single(),
      supabase
        .from('psa_cards')
        .select('psa_spec_id, card_name, card_number, variety, gem_rate_psa10')
        .eq('set_id', specIdNum)
        .order('card_number', { ascending: true }),
    ])

    if (setResult.error) {
      console.error('Set query error:', setResult.error)
      return Response.json({ error: 'Set not found', details: setResult.error }, { status: 404 })
    }

    return Response.json({
      set: setResult.data,
      cards: cardsResult.data || [],
    })
  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal error', details: (error as Error).message }, { status: 500 })
  }
}
