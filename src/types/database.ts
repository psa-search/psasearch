export interface PsaSet {
  set_id: number
  set_name: string
  year: number | null
  created_at: string
}

export interface PsaCard {
  spec_id: string
  card_name: string
  card_number: string | null
  psa_set_id: number
  created_at: string
}

export interface PricePoint {
  date: string
  price: number
}

export interface PsaGradeMetrics {
  spec_id: string
  total_grading_count: number | null
  grade10_gem_count: number | null
  grade10_price_history: PricePoint[] | null
  grade10_auction_sales: PricePoint[] | null
  grade9_gem_count: number | null
  grade9_price_history: PricePoint[] | null
  grade9_auction_sales: PricePoint[] | null
  last_updated: string
}

export interface SnidanPsaMapping {
  snidan_apparel_id: number
  psa_spec_id: string
  snidan_name: string | null
  last_updated: string
}
