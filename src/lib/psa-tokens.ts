import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface PsaApiToken {
  id: number
  token: string
  call_count: number
  reset_date: string
  is_active: boolean
}

export async function rotateTokenCountsIfNeeded(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // リセット日が今日より前のトークンをリセット
  const { error } = await supabase
    .from('psa_api_tokens')
    .update({ call_count: 0, reset_date: today })
    .lt('reset_date', today)
    .eq('is_active', true)

  if (error) {
    console.error('Error resetting token counts:', error)
  }
}

export async function getAvailableToken(): Promise<string | null> {
  // まずカウントのリセットをチェック
  await rotateTokenCountsIfNeeded()

  // call_count < 100 のアクティブなトークンを取得
  const { data: tokens, error } = await supabase
    .from('psa_api_tokens')
    .select('id, token, call_count')
    .eq('is_active', true)
    .lt('call_count', 100)
    .order('call_count', { ascending: true })
    .limit(1)

  if (error) {
    console.error('Error fetching available token:', error)
    return null
  }

  if (!tokens || tokens.length === 0) {
    console.warn('No available tokens with remaining quota')
    return null
  }

  return tokens[0].token
}

export async function incrementTokenUsage(token: string): Promise<boolean> {
  const { error } = await supabase
    .from('psa_api_tokens')
    .update({ call_count: supabase.rpc('increment_call_count', { token_input: token }) as any })
    .eq('token', token)

  if (error) {
    console.error('Error incrementing token usage:', error)
    return false
  }

  return true
}

// より単純な方法：直接カウント増加
export async function incrementTokenCount(token: string): Promise<void> {
  const { data: currentToken, error: fetchError } = await supabase
    .from('psa_api_tokens')
    .select('call_count')
    .eq('token', token)
    .single()

  if (fetchError) {
    console.error('Error fetching token:', fetchError)
    return
  }

  const { error: updateError } = await supabase
    .from('psa_api_tokens')
    .update({ call_count: (currentToken?.call_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq('token', token)

  if (updateError) {
    console.error('Error incrementing token count:', updateError)
  }
}

export async function disableToken(token: string): Promise<void> {
  const { error } = await supabase
    .from('psa_api_tokens')
    .update({ is_active: false })
    .eq('token', token)

  if (error) {
    console.error('Error disabling token:', error)
  }
}

export async function getTokenStatus(): Promise<PsaApiToken[]> {
  const { data, error } = await supabase
    .from('psa_api_tokens')
    .select('*')
    .order('call_count', { ascending: true })

  if (error) {
    console.error('Error fetching token status:', error)
    return []
  }

  return data || []
}
