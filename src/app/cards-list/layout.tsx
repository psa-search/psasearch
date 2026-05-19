import { Suspense } from 'react'

export default function CardsListLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-600">読み込み中...</div>}>
      {children}
    </Suspense>
  )
}
