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
  avgPricePsa10: number | null  // 直近3日平均
  avgPricePsa9: number | null   // 直近3日平均
  priceDiff: number | null      // 平均差額
  salesCount3dPsa10: number
  salesCount3dPsa9: number
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
  hoursAgo: number
  soldAt: string
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
