import { getAvailableToken, incrementTokenCount, getTokenStatus } from '@/lib/psa-tokens'
import { getPsaSalesHistory } from '@/lib/psa'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const certNumber = searchParams.get('certNumber')

    if (!certNumber) {
      return Response.json(
        { error: 'certNumber parameter is required' },
        { status: 400 }
      )
    }

    // 使用可能なトークンを取得
    const token = await getAvailableToken()
    if (!token) {
      const tokenStatus = await getTokenStatus()
      return Response.json(
        {
          error: 'No available API tokens with remaining quota',
          tokenStatus: tokenStatus.map(t => ({
            is_active: t.is_active,
            call_count: t.call_count,
            reset_date: t.reset_date,
          })),
        },
        { status: 429 }
      )
    }

    // PSA Card API に問い合わせ
    const psaUrl = `https://api.psacard.com/publicapi/cert/GetByCertNumber/${certNumber}`
    console.log('[Cert Search] Fetching:', psaUrl)

    const response = await fetch(psaUrl, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    console.log('[Cert Search] Response status:', response.status)
    console.log('[Cert Search] Response data keys:', Object.keys(data).slice(0, 5))

    // Quota exceeded エラーをチェック
    if (data.message?.includes('API calls quota exceeded')) {
      console.log('[Cert Search] Quota exceeded for token, trying next token')
      // このトークンをスキップして次のトークンを試す
      // （再帰的に呼び出すか、クライアント側で再試行）
      return Response.json(
        {
          error: 'Current token quota exceeded, retrying with next token',
          retry: true,
        },
        { status: 429 }
      )
    }

    if (!response.ok) {
      return Response.json(
        { error: data.message || 'Failed to fetch from PSA API' },
        { status: response.status }
      )
    }

    // トークン使用回数をカウント
    await incrementTokenCount(token)

    // データから spec ID を抽出
    // PSA API のレスポンス形式に応じて調整
    const specId = data.specs?.[0]?.specId || data.specId

    if (!specId) {
      return Response.json(
        { error: 'Could not extract specId from PSA API response' },
        { status: 400 }
      )
    }

    return Response.json({
      success: true,
      certNumber,
      specId,
      data: data, // 参考情報として返す
      tokenUsage: {
        message: 'Token usage incremented',
      },
    })
  } catch (error) {
    console.error('[Cert Search] Error:', error)
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
