const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 1991-2026 の年度リンク（HTMLから grep で取得したデータ）
const years = [
  { year: 1991, set_id: 203775 },
  { year: 1992, set_id: 203249 },
  { year: 1993, set_id: 156957 },
  { year: 1994, set_id: 156968 },
  { year: 1995, set_id: 156958 },
  { year: 1996, set_id: 156944 },
  { year: 1997, set_id: 156963 },
  { year: 1998, set_id: 156952 },
  { year: 1999, set_id: 156971 },
  { year: 2000, set_id: 156969 },
  { year: 2001, set_id: 156956 },
  { year: 2002, set_id: 156967 },
  { year: 2003, set_id: 156962 },
  { year: 2004, set_id: 156943 },
  { year: 2005, set_id: 156970 },
  { year: 2006, set_id: 156942 },
  { year: 2007, set_id: 156947 },
  { year: 2008, set_id: 156950 },
  { year: 2009, set_id: 156946 },
  { year: 2010, set_id: 156964 },
  { year: 2011, set_id: 156959 },
  { year: 2012, set_id: 156953 },
  { year: 2013, set_id: 156948 },
  { year: 2014, set_id: 156945 },
  { year: 2015, set_id: 156941 },
  { year: 2016, set_id: 156960 },
  { year: 2017, set_id: 156965 },
  { year: 2018, set_id: 156954 },
  { year: 2019, set_id: 163661 },
  { year: 2020, set_id: 172687 },
  { year: 2021, set_id: 187906 },
  { year: 2022, set_id: 205607 },
  { year: 2023, set_id: 227655 },
  { year: 2024, set_id: 256988 },
  { year: 2025, set_id: 290436 },
  { year: 2026, set_id: 326969 },
]

async function insertYears() {
  try {
    console.log(`Inserting ${years.length} years...`)

    const { data, error } = await supabase
      .from('psa_years')
      .upsert(years, { onConflict: 'year' })
      .select()

    if (error) {
      console.error('Error inserting years:', error.message)
      process.exit(1)
    }

    console.log(`✓ Successfully inserted/updated ${data.length} years`)
    data.forEach((row) => {
      console.log(`  ${row.year}: set_id=${row.set_id}`)
    })
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

insertYears()
