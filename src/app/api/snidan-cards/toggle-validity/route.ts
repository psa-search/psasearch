import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { apparelId, isValid } = await request.json()

    if (!apparelId) {
      return Response.json(
        { success: false, error: 'apparelId is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('snidan_cards')
      .update({ is_valid: isValid })
      .eq('snidan_apparel_id', apparelId)

    if (error) {
      throw new Error(error.message)
    }

    return Response.json({
      success: true,
    })
  } catch (error) {
    console.error('[Toggle Validity] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
