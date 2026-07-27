import { NextRequest, NextResponse } from 'next/server'
import { uploadFile, getSignedUrl } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ ok: false, error: 'file 필요' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    // 저장 경로는 서버에서 만든다 (브라우저가 보낸 문자열을 경로로 쓰지 않음).
    // 회사 버킷 안에서 line-photos/ 폴더로 보관한다.
    const path = `line-photos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    await uploadFile(path, bytes, file.type || 'image/jpeg')

    // DB에는 path 만 저장한다. url 은 업로드 직후 미리보기용 임시 주소.
    const url = await getSignedUrl(path)
    return NextResponse.json({ ok: true, path, url })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '업로드 실패' }, { status: 500 })
  }
}
