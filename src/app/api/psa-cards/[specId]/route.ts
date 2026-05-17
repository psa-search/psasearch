import { createClient } from '@supabase/supabase-js'
import { fetchAndSaveCardImages } from '@/app/actions/psa'

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

    const { data: card } = await supabase
      .from('psa_cards')
      .select(`
        psa_spec_id,
        card_name,
        card_name_ja,
        card_number,
        variety,
        total_graded,
        gem_count_psa10,
        gem_rate_psa10,
        image_urls,
        set_id,
        psa_psa10_avg_price_3d,
        psa_psa10_qty_3d,
        psa_psa9_avg_price_3d,
        psa_psa9_qty_3d,
        snidan_apparel_id,
        snidan_psa10_avg_price_3d,
        snidan_psa10_qty_3d,
        snidan_psa9_avg_price_3d,
        snidan_psa9_qty_3d,
        snidan_code
      `)
      .eq('psa_spec_id', parseInt(specId))
      .single()

    if (!card) {
      return Response.json({ error: 'Card not found' }, { status: 404 })
    }

    let imageUrls = card.image_urls

    // If no images in DB, fetch them
    if (!imageUrls || imageUrls.length === 0) {
      imageUrls = await fetchAndSaveCardImages(parseInt(specId))
    }

    const { data: set } = await supabase
      .from('psa_sets')
      .select('set_name, set_code, year, psa_spec_id')
      .eq('psa_spec_id', card.set_id)
      .single()

    if (!set) {
      return Response.json({ error: 'Set not found' }, { status: 404 })
    }

    // Convert USD to JPY for display
    const { getDollarRate } = await import('@/lib/exchange-rate')
    const rate = await getDollarRate()
    const psa10Jpy = card?.psa_psa10_avg_price_3d ? Math.round(card.psa_psa10_avg_price_3d * rate) : null
    const psa9Jpy = card?.psa_psa9_avg_price_3d ? Math.round(card.psa_psa9_avg_price_3d * rate) : null

    return Response.json({
      psa_spec_id: card.psa_spec_id,
      card_name: card.card_name,
      card_name_ja: card.card_name_ja,
      card_number: card.card_number,
      variety: card.variety,
      total_graded: card.total_graded,
      gem_count_psa10: card.gem_count_psa10,
      gem_rate_psa10: card.gem_rate_psa10,
      image_urls: imageUrls,
      psa_psa10_avg_price_3d: psa10Jpy,
      psa_psa10_qty_3d: card.psa_psa10_qty_3d,
      psa_psa9_avg_price_3d: psa9Jpy,
      psa_psa9_qty_3d: card.psa_psa9_qty_3d,
      snidan_apparel_id: card.snidan_apparel_id,
      snidan_psa10_avg_price_3d: card.snidan_psa10_avg_price_3d,
      snidan_psa10_qty_3d: card.snidan_psa10_qty_3d,
      snidan_psa9_avg_price_3d: card.snidan_psa9_avg_price_3d,
      snidan_psa9_qty_3d: card.snidan_psa9_qty_3d,
      snidan_code: card.snidan_code,
      set: {
        set_name: set.set_name,
        set_code: set.set_code,
        year: set.year,
        psa_spec_id: set.psa_spec_id,
      },
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
