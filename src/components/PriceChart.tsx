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
  psa10Official?: Array<{ date: string; price: number | null }>
  psa9Official?: Array<{ date: string; price: number | null }>
  height?: number
}

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatPrice(v: number) {
  return `¥${v.toLocaleString()}`
}

export default function PriceChart({ psa10, psa9, psa10Official, psa9Official, height = 300 }: Props) {
  // Snidan: timestamp キー、PSA公式: date キーを使用
  const psa10Data = psa10 || []
  const psa9Data = psa9 || []
  const tsSet = new Set([...psa10Data.map((p) => p.timestamp), ...psa9Data.map((p) => p.timestamp)])
  const psa10Map = new Map(psa10Data.map((p) => [p.timestamp, p.price]))
  const psa9Map = new Map(psa9Data.map((p) => [p.timestamp, p.price]))

  // PSA公式データを日付ごとにマップ化（ISO 8601 形式）
  const psa10OfficialMap = new Map((psa10Official || []).map((p) => [p.date.split('T')[0], p.price]))
  const psa9OfficialMap = new Map((psa9Official || []).map((p) => [p.date.split('T')[0], p.price]))

  const data = Array.from(tsSet)
    .sort((a, b) => a - b)
    .map((ts) => {
      const d = new Date(ts)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return {
        ts, // ユニークキー（位置決め用）
        date: formatDate(ts), // 表示用
        PSA10: psa10Map.get(ts) ?? null,
        PSA9: psa9Map.get(ts) ?? null,
        PSA10公式: psa10OfficialMap.get(dateStr) ?? null,
        PSA9公式: psa9OfficialMap.get(dateStr) ?? null,
      }
    })

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">データなし</div>
  }

  // データ量に応じてXAxisのラベル間隔を調整（最大12個）
  const xInterval = Math.max(1, Math.floor(data.length / 12))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
        <XAxis
          dataKey="ts"
          tickFormatter={(ts) => formatDate(ts)}
          tick={{ fontSize: 11, fill: '#000000' }}
          stroke="#000000"
          interval={xInterval}
        />
        <YAxis
          tickFormatter={(v) => `¥${v.toLocaleString()}`}
          tick={{ fontSize: 11, fill: '#000000' }}
          stroke="#000000"
          position="insideLeft"
          width={50}
        />
        <Tooltip
          formatter={(value) => typeof value === 'number' ? formatPrice(value) : String(value)}
          labelFormatter={(ts) => formatDate(Number(ts))}
          contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '11px' }}
          labelStyle={{ color: '#000000', fontSize: '11px' }}
        />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Line
          type="linear"
          dataKey="PSA10"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
          name=""
        />
        <Line
          type="linear"
          dataKey="PSA9"
          stroke="#6B7280"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
          name=""
        />
        <Line
          type="linear"
          dataKey="PSA10公式"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
          isAnimationActive={false}
          name="公式"
        />
        <Line
          type="linear"
          dataKey="PSA9公式"
          stroke="#10B981"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
          isAnimationActive={false}
          name=""
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
