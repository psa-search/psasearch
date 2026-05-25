import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { setCode, cardNumber, masterBallOnly, reverseHoloOnly } = await request.json()

    if (!setCode || !cardNumber) {
      return Response.json(
        { success: false, error: 'setCode and cardNumber are required' },
        { status: 400 }
      )
    }

    // cardNumber の先頭ゼロを削除
    const normalizedCardNumber = parseInt(cardNumber).toString()

    // まず set_code に合致するセットを取得
    const { data: sets, error: setsError } = await supabase
      .from('psa_sets')
      .select('psa_spec_id, set_code')
      .ilike('set_code', setCode)

    console.log(`[Find Candidates] setCode: ${setCode}, found sets:`, sets)

    if (setsError) {
      throw new Error(setsError.message)
    }

    if (!sets || sets.length === 0) {
      console.log(`[Find Candidates] No sets found for setCode: ${setCode}`)
      return Response.json({
        success: true,
        candidates: []
      })
    }

    // 複数のセット ID すべてから候補を検索
    let allCandidates: any[] = []

    for (const setRecord of sets) {
      const setId = setRecord.psa_spec_id
      console.log(`[Find Candidates] Searching in setId: ${setId}`)

      // 先頭ゼロ付きで前方一致検索
      let query = supabase
        .from('psa_cards')
        .select('psa_spec_id, card_name, variety, card_number, image_urls')
        .eq('set_id', setId)
        .ilike('card_number', `${cardNumber}%`)
        .eq('is_valid', true)

      if (masterBallOnly) {
        query = query.ilike('variety', '%Master Ball%')
      }

      let { data: candidates } = await query

      // 見つからない場合は先頭ゼロなしで前方一致検索
      if (!candidates || candidates.length === 0) {
        let query2 = supabase
          .from('psa_cards')
          .select('psa_spec_id, card_name, variety, card_number, image_urls')
          .eq('set_id', setId)
          .ilike('card_number', `${normalizedCardNumber}%`)
          .eq('is_valid', true)

        if (masterBallOnly) {
          query2 = query2.ilike('variety', '%Master Ball%')
        }

        const { data: candidates2 } = await query2
        if (candidates2 && candidates2.length > 0) {
          candidates = candidates2
        }
      }

      if (candidates && candidates.length > 0) {
        allCandidates.push(...candidates)
        console.log(`[Find Candidates] Found ${candidates.length} candidates in setId ${setId}`)
      }
    }

    console.log(`[Find Candidates] cardNumber: ${cardNumber}, total candidates:`, allCandidates?.length)
    const candidates = allCandidates
    if (candidates && candidates.length > 0) {
      console.log(`[Find Candidates] Sample: ${JSON.stringify(candidates[0])}`)
    }

    // set_code と画像を追加
    let flattenedCandidates = (candidates || []).map((c: any) => ({
      psa_spec_id: c.psa_spec_id,
      card_name: c.card_name,
      variety: c.variety,
      card_number: c.card_number,
      set_code: setCode,
      image_urls: c.image_urls
    }))

    // // Reverse Holo のみフィルタリング
    // if (1 == 1) {
    //   flattenedCandidates = flattenedCandidates.filter((c: any) =>
    //     c.variety && c.variety == 'Reverse Holo'
    //   )
    // }

    // カード名の昇順、同じ名前の場合はバリエーションの昇順でソート
    flattenedCandidates.sort((a: any, b: any) => {
      const nameCompare = (a.card_name || '').localeCompare(b.card_name || '', 'ja')
      if (nameCompare !== 0) return nameCompare
      return (a.variety || '').localeCompare(b.variety || '', 'ja')
    })

    return Response.json({
      success: true,
      candidates: flattenedCandidates
    })
  } catch (error) {
    console.error('[Find Candidates] Error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
