import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const nz = (v: any) => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export async function POST(req: NextRequest) {
  const rows = await req.json()
  try {
    const records = rows.map((r: any) => ({
      item_code: nz(r.item_code),
      color_code: nz(r.color_code) ?? '',
      item_name: nz(r.item_name),
      production_line: nz(r.production_line),
      line_code: nz(r.line_code),
      pack_plan_date: nz(r.pack_plan_date),
      first_pack_date: nz(r.first_pack_date),
      plan_qty: r.plan_qty ?? null,
      partner: nz(r.partner),
      shift: nz(r.shift),
      lot_number: nz(r.lot_number),
      status: 'active',
    }))

    const cols = ['item_code','color_code','item_name','production_line','line_code','pack_plan_date','first_pack_date','plan_qty','partner','shift','lot_number','status']
    const values: any[] = []
    const placeholders: string[] = []
    let idx = 1
    for (const r of records) {
      const ph = cols.map(() => `$${idx++}`)
      placeholders.push(`(${ph.join(',')})`)
      for (const c of cols) values.push(r[c])
    }

    await pool.query(
      `INSERT INTO production_plans (${cols.join(',')})
       VALUES ${placeholders.join(',')}
       ON CONFLICT (item_code, color_code, pack_plan_date, lot_number) DO NOTHING`,
      values,
    )

    return NextResponse.json({ ok: true, inserted: records.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: '저장 실패: ' + (e?.message ?? e) }, { status: 500 })
  }
}
