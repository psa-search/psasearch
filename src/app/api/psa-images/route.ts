import { fetchAndSaveCardImages } from '@/app/actions/psa'

export async function POST(request: Request) {
  try {
    const { specId } = await request.json()

    if (!specId) {
      return Response.json(
        { error: 'specId is required' },
        { status: 400 }
      )
    }

    const imageIds = await fetchAndSaveCardImages(specId)

    if (imageIds.length === 0) {
      return Response.json(
        { success: false, error: '画像が見つかりませんでした' },
        { status: 404 }
      )
    }

    return Response.json({
      success: true,
      imageIds,
      message: `${imageIds.length}件の画像を取得しました`,
    })
  } catch (error) {
    console.error('[PSA Images] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
