import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    const unlinkedOnly = searchParams.get('unlinked_only') === 'true'
    const keyword = searchParams.get('keyword')

    // snidan_cards を取得（除外済みを除く）
    let query = supabase
      .from('snidan_cards')
      .select('*')
      .eq('is_valid', true)
      .order('id', { ascending: true })

    if (unlinkedOnly) {
      query = query.is('psa_spec_id', null)
    }

    if (keyword) {
      query = query.ilike('snidan_name_ja', `%${keyword}%`)
    }

    const { data: cards, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      throw new Error(error.message)
    }

    // 統計を計算（全件を数える）
    const { count: totalCount } = await supabase
      .from('snidan_cards')
      .select('*', { count: 'exact', head: true })

    const { count: linkedCount } = await supabase
      .from('snidan_cards')
      .select('*', { count: 'exact', head: true })
      .not('psa_spec_id', 'is', null)

    const unlinkedCount = (totalCount || 0) - (linkedCount || 0)

    const stats = {
      linked: linkedCount,
      unlinked: unlinkedCount,
      multiple: 0,
    }

    return Response.json({
      cards: cards || [],
      stats,
    })
  } catch (error) {
    console.error('[Snidan Cards API] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
