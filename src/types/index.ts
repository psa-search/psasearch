export interface SnidanCard {
  id: number
  name: string
  localizedName: string
  imageUrl: string
  productNumber: string
}

export interface SnidanListing {
  id: number
  apparel: SnidanCard
  price: number
  wearCount: string
  displayWearCount: string
}

export interface PricePoint {
  timestamp: number
  price: number
}

export interface PriceChart {
  points: PricePoint[]
  rangeKeys: { key: string; text: string; enabled: boolean }[]
}

export interface CardWithTrend {
  id: number
  name: string
  localizedName: string
  imageUrl: string
  productNumber: string
  currentPricePsa10: number | null
  currentPricePsa9: number | null
  priceDiff: number | null
  trendPercent: number | null // 1ヶ月の価格変化率
  chartPsa10: PricePoint[]
  chartPsa9: PricePoint[]
}

export interface PsaGradeSummary {
  grade: number
  quantity: number
  minimumPrice: number
  maximumPrice: number
  averagePrice: number
  latestPrice: number
}

export interface PsaCardData {
  specId: string
  gradeSummaries: PsaGradeSummary[]
  growthRate: number | null
  salesCount: number
}

export interface SalesRecord {
  price: number
  date: string
  condition: string
}

export interface SearchResult {
  apparelId: number
  listingId: number
  name: string
  localizedName: string
  imageUrl: string
  productNumber: string
  price: number
}
