'use client'

import Link from 'next/link'
import { updateSetCards } from '../actions/psa'
import { useState } from 'react'

interface SetCardProps {
  psa_spec_id: number
  set_name: string
  set_code: string | null
  card_count: number
}

export function SetCard({ psa_spec_id, set_name, set_code, card_count }: SetCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleUpdate = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await updateSetCards(psa_spec_id, set_name)
      if (result.success) {
        setMessage({ text: `✓ ${result.cardCount}枚のカードを取得`, type: 'success' })
        // 3秒後にメッセージを消す
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ text: `✗ ${result.message}`, type: 'error' })
      }
    } catch (error) {
      setMessage({ text: `✗ エラーが発生しました`, type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Link
      href={`/sets/${psa_spec_id}`}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {set_code && <span className="text-blue-600 font-bold">[{set_code}] </span>}
            {set_name}
          </h3>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{card_count}カード取得済み</p>
        {card_count === 0 && (
          <button
            onClick={handleUpdate}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '取得中...' : '更新'}
          </button>
        )}
      </div>
      {message && (
        <p className={`text-xs mt-2 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </Link>
  )
}
