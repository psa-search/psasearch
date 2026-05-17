import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { specId } = await request.json()

    if (!specId) {
      return Response.json({ error: 'specId is required' }, { status: 400 })
    }

    // Delete all snidan-related data
    const { error: deleteError } = await supabase
      .from('psa_cards')
      .update({
        snidan_apparel_id: null,
        snidan_psa10_avg_price_3d: null,
        snidan_psa9_avg_price_3d: null,
        snidan_psa10_qty_3d: null,
        snidan_psa9_qty_3d: null,
        snidan_code: null,
      })
      .eq('psa_spec_id', specId)

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: 'Snidan link deleted',
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
