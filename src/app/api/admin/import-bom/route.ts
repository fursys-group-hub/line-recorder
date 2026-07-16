import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const rows = await req.json()
  try {
    const uniqueMats = Array.from(new Map(rows.map((r: any) => [`${r.material_code}::${r.material_color}`, {
      material_code: r.material_code, material_color: r.material_color,
      material_name: r.material_name, material_category: r.material_category ?? null,
    }])).values()) as any[]

    // Upsert materials
    for (const m of uniqueMats) {
      await pool.query(
        `INSERT INTO materials (material_code, material_color, material_name, material_category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (material_code, material_color)
         DO UPDATE SET material_name = EXCLUDED.material_name, material_category = EXCLUDED.material_category`,
        [m.material_code, m.material_color, m.material_name, m.material_category],
      )
    }

    // Fetch all materials to build ID map
    const { rows: matData } = await pool.query('SELECT id, material_code, material_color FROM materials')
    const matMap = new Map(matData.map((m: any) => [`${m.material_code}::${m.material_color}`, m.id]))

    // Build BOM payload
    const bomPayload = rows.map((r: any) => ({
      item_code: r.item_code, color_code: r.color_code,
      material_id: matMap.get(`${r.material_code}::${r.material_color}`),
      quantity: r.quantity ?? 1,
    })).filter((r: any) => r.material_id)

    // Upsert BOM
    for (const b of bomPayload) {
      await pool.query(
        `INSERT INTO bom (item_code, color_code, material_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (item_code, color_code, material_id) DO NOTHING`,
        [b.item_code, b.color_code, b.material_id, b.quantity],
      )
    }

    return NextResponse.json({ ok: true, materials: uniqueMats.length, bom_rows: bomPayload.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: '저장 실패: ' + (e?.message ?? e) }, { status: 500 })
  }
}
