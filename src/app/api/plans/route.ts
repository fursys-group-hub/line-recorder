import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const line = searchParams.get('line')
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const statusFilter = searchParams.get('status')
  const withTotals = searchParams.get('withTotals')

  try {
    const conditions: string[] = []
    const params: any[] = []
    let idx = 1

    if (statusFilter && statusFilter !== 'all') {
      conditions.push(`status = $${idx++}`)
      params.push(statusFilter)
    } else if (!statusFilter) {
      conditions.push(`status = $${idx++}`)
      params.push('active')
    }

    if (dateFrom && dateTo) {
      conditions.push(`pack_plan_date >= $${idx++}`)
      params.push(dateFrom)
      conditions.push(`pack_plan_date <= $${idx++}`)
      params.push(dateTo)
    } else if (date) {
      conditions.push(`pack_plan_date = $${idx++}`)
      params.push(date)
    }

    if (line) {
      conditions.push(`production_line ILIKE $${idx++}`)
      params.push(`%${line}%`)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const order = statusFilter === 'all' || !statusFilter ? 'ORDER BY pack_plan_date DESC' : 'ORDER BY pack_plan_date'
    const { rows } = await pool.query(`SELECT * FROM production_plans ${where} ${order}`, params)

    if (withTotals === 'true') {
      const { rows: totals } = await pool.query(
        `SELECT plan_id, SUM(good_qty) as total_good
         FROM line_records
         WHERE mode = 'lot' AND plan_id IS NOT NULL
         GROUP BY plan_id`,
      )
      const totalMap: Record<string, number> = {}
      totals.forEach((r: any) => { totalMap[r.plan_id] = Number(r.total_good) })
      return NextResponse.json({ plans: rows, totals: totalMap })
    }

    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json([], { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json()
  try {
    await pool.query('UPDATE production_plans SET status = $1 WHERE id = $2', [status, id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
