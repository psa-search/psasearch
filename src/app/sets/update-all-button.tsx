'use client'

import { updateAllEmptySets } from '../actions/psa'
import { useState } from 'react'

export function UpdateAllButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleUpdateAll = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await updateAllEmptySets()
      if (result.success) {
        setMessage({ text: `✓ ${result.message}`, type: 'success' })
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
    <div className="flex items-center gap-4">
      <button
        onClick={handleUpdateAll}
        disabled={isLoading}
        className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? '更新中...' : '未取得更新'}
      </button>
      {message && (
        <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
