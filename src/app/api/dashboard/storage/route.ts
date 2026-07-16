import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const { rows } = await pool.query('SELECT * FROM storage_usage()')
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
