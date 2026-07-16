import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ ok: false, error: 'file 필요' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const publicUrl = await uploadFile('line-photos', path, bytes, file.type || 'image/jpeg')

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '업로드 실패' }, { status: 500 })
  }
}
