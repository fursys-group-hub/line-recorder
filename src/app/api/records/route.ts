import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { signPaths } from '@/lib/storage'

const splitPaths = (v: unknown): string[] =>
  typeof v === 'string' && v.trim()
    ? v.split(',').map((s) => s.trim()).filter(Boolean)
    : []

// 각 행의 photo_urls(콤마로 합쳐진 저장 경로)를 임시 조회 주소로 바꾼다.
// 스토리지 접속이 실패해도 기록 데이터는 그대로 반환한다(사진만 일시적으로 안 보임).
async function resolvePhotoUrls(rows: any[]): Promise<void> {
  const all = new Set<string>()
  for (const r of rows) splitPaths(r?.photo_urls).forEach((p) => all.add(p))
  if (!all.size) return
  let map: Record<string, string> = {}
  try {
    map = await signPaths(Array.from(all))
  } catch {
    return
  }
  for (const r of rows) {
    const paths = splitPaths(r?.photo_urls)
    if (paths.length) r.photo_urls = paths.map((p) => map[p] ?? p).join(',')
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'today'
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const line = searchParams.get('line')
  const item = searchParams.get('item')
  const mode = searchParams.get('mode')
  const hasVideo = searchParams.get('hasVideo')
  const hasPhoto = searchParams.get('hasPhoto')
  const fields = searchParams.get('fields')
  const limitParam = searchParams.get('limit')

  try {
    const conditions: string[] = []
    const params: any[] = []
    let idx = 1

    if (filter === 'today') {
      const s = new Date(); s.setHours(0, 0, 0, 0)
      conditions.push(`recorded_at >= $${idx++}`)
      params.push(s.toISOString())
    } else if (filter === 'week') {
      const s = new Date(); s.setDate(s.getDate() - 7)
      conditions.push(`recorded_at >= $${idx++}`)
      params.push(s.toISOString())
    } else if (filter === 'custom' && dateFrom && dateTo) {
      conditions.push(`recorded_at >= $${idx++}`)
      params.push(`${dateFrom}T00:00:00`)
      conditions.push(`recorded_at <= $${idx++}`)
      params.push(`${dateTo}T23:59:59`)
    }

    if (line) { conditions.push(`production_line = $${idx++}`); params.push(line) }
    if (item) { conditions.push(`item_code = $${idx++}`); params.push(item) }
    if (mode) { conditions.push(`mode = $${idx++}`); params.push(mode) }
    if (hasVideo === 'true') { conditions.push('video_url IS NOT NULL') }
    if (hasPhoto === 'true') { conditions.push('photo_urls IS NOT NULL') }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const cols = fields || '*'
    const limit = Math.min(Number(limitParam) || 500, 2000)

    const { rows } = await pool.query(
      `SELECT ${cols} FROM line_records ${where} ORDER BY recorded_at DESC LIMIT $${idx}`,
      [...params, limit],
    )
    await resolvePhotoUrls(rows)
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown', db: !!process.env.DATABASE_URL }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, notify, ...fields } = await req.json()
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })

    const allowed = ['production_line','item_code','color_code','item_name','input_qty','good_qty','defect_qty','defect_types','defect_materials','memo','video_url','st_seconds','review_status','improve_due','review_comment']
    const numeric = new Set(['input_qty','good_qty','defect_qty','st_seconds'])
    const nullableEmpty = new Set(['improve_due'])
    const update: Record<string, any> = {}
    for (const k of allowed) {
      if (!(k in fields)) continue
      let v = fields[k]
      if (numeric.has(k)) {
        v = (v === '' || v === null || v === undefined) ? null : Number(v)
        if (v !== null && Number.isNaN(v)) v = null
      } else if (nullableEmpty.has(k)) {
        v = (v === '' || v === null || v === undefined) ? null : v
      }
      update[k] = v
    }

    if ('input_qty' in update && 'good_qty' in update && update.input_qty !== null && update.good_qty !== null) {
      const inp = Number(update.input_qty) || 0
      const good = Number(update.good_qty) || 0
      update.defect_qty = inp - good
      update.yield_pct = inp > 0 ? ((good / inp) * 100).toFixed(2) : null
    }

    const keys = Object.keys(update)
    if (keys.length === 0) return NextResponse.json({ ok: true })
    const sets = keys.map((k, i) => `${k} = $${i + 1}`)
    const vals = keys.map(k => update[k])
    vals.push(id)

    await pool.query(
      `UPDATE line_records SET ${sets.join(', ')} WHERE id = $${vals.length}`,
      vals,
    )

    if (notify) {
      try {
        const { rows } = await pool.query('SELECT * FROM line_records WHERE id = $1', [id])
        if (rows[0]) {
          const origin = new URL(req.url).origin
          await fetch(`${origin}/api/slack-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ record: rows[0], edited: true }),
          })
        }
      } catch { /* 알림 실패는 수정 성공에 영향 주지 않음 */ }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })

    await pool.query('DELETE FROM line_records WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '삭제 실패' }, { status: 500 })
  }
}
