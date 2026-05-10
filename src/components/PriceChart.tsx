'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PricePoint } from '@/types'

interface Props {
  psa10: PricePoint[]
  psa9: PricePoint[]
  height?: number
}

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatPrice(v: number) {
  return `¥${v.toLocaleString()}`
}

export default function PriceChart({ psa10, psa9, height = 300 }: Props) {
  // PSA10とPSA9のデータをマージ（日付キー）
  const tsSet = new Set([...psa10.map((p) => p.timestamp), ...psa9.map((p) => p.timestamp)])
  const psa10Map = new Map(psa10.map((p) => [p.timestamp, p.price]))
  const psa9Map = new Map(psa9.map((p) => [p.timestamp, p.price]))

  const data = Array.from(tsSet)
    .sort((a, b) => a - b)
    .map((ts) => ({
      ts, // ユニークキー（位置決め用）
      date: formatDate(ts), // 表示用
      PSA10: psa10Map.get(ts) ?? null,
      PSA9: psa9Map.get(ts) ?? null,
    }))

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">データなし</div>
  }

  // データ量に応じてXAxisのラベル間隔を調整（最大12個）
  const xInterval = Math.max(1, Math.floor(data.length / 12))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="ts"
          tickFormatter={(ts) => formatDate(ts)}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          interval={xInterval}
        />
        <YAxis
          tickFormatter={(v) => `¥${v.toLocaleString()}`}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          width={90}
        />
        <Tooltip
          formatter={(value) => typeof value === 'number' ? formatPrice(value) : String(value)}
          labelFormatter={(ts) => formatDate(Number(ts))}
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
          labelStyle={{ color: '#E5E7EB' }}
        />
        <Legend />
        <Line
          type="linear"
          dataKey="PSA10"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="PSA9"
          stroke="#6B7280"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
