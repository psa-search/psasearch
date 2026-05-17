import { createClient } from '@supabase/supabase-js'
import { SetCard } from './set-card'
import { UpdateAllButton } from './update-all-button'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const revalidate = 3600

interface Set {
  psa_spec_id: number
  year: number
  set_name: string
  set_code: string | null
  card_count: number
}

async function getSetsWithCardCount(): Promise<Map<number, Set[]>> {
  const { data: setsWithCounts } = await supabase
    .rpc('get_sets_with_card_counts')
    .order('year', { ascending: false })
    .order('set_name')

  const setsByYear = new Map<number, Set[]>()

  if (setsWithCounts) {
    for (const row of setsWithCounts) {
      const year = row.year
      const cardCount = row.card_count || 0

      if (!setsByYear.has(year)) {
        setsByYear.set(year, [])
      }

      setsByYear.get(year)!.push({
        psa_spec_id: row.psa_spec_id,
        year: row.year,
        set_name: row.set_name,
        set_code: row.set_code,
        card_count: cardCount,
      })
    }
  }

  return setsByYear
}

export default async function SetsPage() {
  const setsByYear = await getSetsWithCardCount()
  const years = Array.from(setsByYear.keys()).sort((a, b) => b - a)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-4xl font-bold text-gray-900">セット一覧</h1>
          <UpdateAllButton />
        </div>

        {years.map((year) => {
          const yearSets = setsByYear.get(year) || []
          const totalCards = yearSets.reduce((sum, set) => sum + set.card_count, 0)

          return (
            <div key={year} className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{year}年</h2>
                <span className="text-lg text-gray-600">
                  {yearSets.length}セット / {totalCards}カード
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearSets.map((set) => (
                  <SetCard
                    key={set.psa_spec_id}
                    psa_spec_id={set.psa_spec_id}
                    set_name={set.set_name}
                    set_code={set.set_code}
                    card_count={set.card_count}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
