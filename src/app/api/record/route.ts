import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const yieldPct = body.input_qty && body.good_qty
    ? Math.round((body.good_qty / body.input_qty) * 1000) / 10 : null
  const photoUrls: string[] = Array.isArray(body.photo_urls) ? body.photo_urls.filter(Boolean) : []

  try {
    const { rows } = await pool.query(
      `INSERT INTO line_records
        (mode, plan_id, item_code, color_code, item_name, production_line, worker, shift,
         input_qty, good_qty, defect_qty, yield_pct, defect_types, defect_materials,
         st_seconds, photo_urls, video_url, memo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        body.mode,
        body.plan_id ?? null,
        body.item_code,
        body.color_code,
        body.item_name ?? null,
        body.production_line,
        body.worker ?? null,
        body.shift ?? null,
        body.input_qty ?? null,
        body.good_qty ?? null,
        body.defect_qty ?? null,
        yieldPct,
        body.defect_types?.join(',') ?? null,
        body.defect_materials?.join(',') ?? null,
        body.st_seconds ?? null,
        photoUrls.length ? photoUrls.join(',') : null,
        body.video_url ?? null,
        body.memo ?? null,
      ],
    )

    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '저장 실패' }, { status: 500 })
  }
}
