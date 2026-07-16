import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const itemCode = searchParams.get('item_code')
  const colorCode = searchParams.get('color_code')
  const full = searchParams.get('full')
  const products = searchParams.get('products')

  if (products === 'true') {
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT item_code, color_code, item_name
         FROM production_plans WHERE status = 'active' ORDER BY item_code`,
      )
      return NextResponse.json(rows)
    } catch {
      return NextResponse.json([])
    }
  }

  if (!itemCode || !colorCode) return NextResponse.json([])

  try {
    if (full === 'true') {
      const { rows } = await pool.query(
        `SELECT b.id, b.item_code, b.color_code, b.material_id, b.quantity, b.is_active,
                m.id as m_id, m.material_code, m.material_color, m.material_name, m.material_category
         FROM bom b
         LEFT JOIN materials m ON b.material_id = m.id
         WHERE b.item_code = $1 AND b.color_code = $2`,
        [itemCode, colorCode],
      )
      const result = rows.map(r => ({
        id: r.id, item_code: r.item_code, color_code: r.color_code,
        material_id: r.material_id, quantity: r.quantity, is_active: r.is_active,
        materials: {
          id: r.m_id, material_code: r.material_code, material_color: r.material_color,
          material_name: r.material_name, material_category: r.material_category,
        },
      }))
      return NextResponse.json(result)
    }

    const { rows } = await pool.query(
      `SELECT m.id, m.material_code, m.material_color, m.material_name, m.material_category
       FROM bom b
       JOIN materials m ON b.material_id = m.id
       WHERE b.item_code = $1 AND b.color_code = $2 AND b.is_active = true`,
      [itemCode, colorCode],
    )
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    const { item_code, color_code, material_id, quantity } = await req.json()
    await pool.query(
      `INSERT INTO bom (item_code, color_code, material_id, quantity, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (item_code, color_code, material_id)
       DO UPDATE SET quantity = $4, is_active = true`,
      [item_code, color_code, material_id, quantity ?? 1],
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '저장 실패' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, is_active } = await req.json()
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 })
    await pool.query('UPDATE bom SET is_active = $1 WHERE id = $2', [is_active, id])
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
    await pool.query('DELETE FROM bom WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? '삭제 실패' }, { status: 500 })
  }
}
