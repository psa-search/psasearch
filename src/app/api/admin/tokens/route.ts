import { createClient } from '@supabase/supabase-js'
import { getTokenStatus } from '@/lib/psa-tokens'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    const tokenStatus = await getTokenStatus()

    return Response.json({
      success: true,
      tokens: tokenStatus.map((t, idx) => ({
        index: idx + 1,
        is_active: t.is_active,
        call_count: t.call_count,
        remaining_quota: 100 - t.call_count,
        reset_date: t.reset_date,
        created_at: t.created_at,
      })),
      summary: {
        total_tokens: tokenStatus.length,
        active_tokens: tokenStatus.filter(t => t.is_active).length,
        tokens_with_quota: tokenStatus.filter(t => t.is_active && t.call_count < 100).length,
      },
    })
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { action, token } = await request.json()

    if (action === 'add' && token) {
      // 新しいトークンを追加
      const { error } = await supabase
        .from('psa_api_tokens')
        .insert({
          token,
          call_count: 0,
          reset_date: new Date().toISOString().split('T')[0],
          is_active: true,
        })

      if (error) {
        return Response.json(
          { error: error.message },
          { status: 400 }
        )
      }

      return Response.json({ success: true, message: 'Token added' })
    }

    if (action === 'disable' && token) {
      // トークンを無効化
      const { error } = await supabase
        .from('psa_api_tokens')
        .update({ is_active: false })
        .eq('token', token)

      if (error) {
        return Response.json(
          { error: error.message },
          { status: 400 }
        )
      }

      return Response.json({ success: true, message: 'Token disabled' })
    }

    if (action === 'reset-all') {
      // すべてのトークンのカウントをリセット
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase
        .from('psa_api_tokens')
        .update({ call_count: 0, reset_date: today })
        .eq('is_active', true)

      if (error) {
        return Response.json(
          { error: error.message },
          { status: 400 }
        )
      }

      return Response.json({ success: true, message: 'All tokens reset' })
    }

    return Response.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
