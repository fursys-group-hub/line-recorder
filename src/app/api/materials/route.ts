import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM materials ORDER BY material_category, material_code',
    )
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows } = await pool.query(
      `INSERT INTO materials (material_code, material_color, material_name, material_category)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.material_code, body.material_color ?? 'XX', body.material_name, body.material_category ?? '기타'],
    )
    return NextResponse.json({ ok: true, data: rows[0] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '저장 실패' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json()
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })

    const allowed = ['material_code', 'material_color', 'material_name', 'material_category', 'is_active']
    const sets: string[] = []
    const vals: any[] = []
    let idx = 1
    for (const k of allowed) {
      if (k in fields) {
        sets.push(`${k} = $${idx++}`)
        vals.push(fields[k])
      }
    }
    if (sets.length === 0) return NextResponse.json({ ok: false, error: '변경 없음' }, { status: 400 })
    vals.push(id)

    await pool.query(`UPDATE materials SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '수정 실패' }, { status: 500 })
  }
}
