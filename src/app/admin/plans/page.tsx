'use client'
import { useEffect, useState } from 'react'

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'completed'>('active')
  const [onlyOver100, setOnlyOver100] = useState(false)
  const [sortBy, setSortBy] = useState<'date'|'pct'>('date')
  const [q, setQ] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/plans?status=all&withTotals=true')
    if (res.ok) {
      const data = await res.json()
      setPlans(data.plans ?? [])
      setTotals(data.totals ?? {})
    }
    setLoading(false)
  }

  async function toggleStatus(plan: any) {
    const next = plan.status === 'completed' ? 'active' : 'completed'
    await fetch('/api/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plan.id, status: next }),
    })
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: next } : p))
  }

  const pctOf = (p:any) => p.plan_qty > 0 ? (totals[p.id] ?? 0) / p.plan_qty * 100 : 0

  const kw = q.trim().toLowerCase()
  let filtered = plans.filter(p =>
    (filterStatus === 'all' ? true : p.status === filterStatus) &&
    (!onlyOver100 || pctOf(p) >= 100) &&
    (kw === '' || `${p.item_name ?? ''} ${p.item_code ?? ''} ${p.color_code ?? ''}`.toLowerCase().includes(kw))
  )

  if (sortBy === 'pct') {
    filtered = [...filtered].sort((a,b) => pctOf(b) - pctOf(a))
  }

  const activeCount = plans.filter(p => p.status !== 'completed').length
  const completedCount = plans.filter(p => p.status === 'completed').length
  const over100Count = plans.filter(p => pctOf(p) >= 100).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">투입 계획 관리</h1>
        <div className="flex gap-2 text-xs">
          <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">진행중 {activeCount}</span>
          <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">100%↑ {over100Count}</span>
          <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">완료 {completedCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {(['active','all','completed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus===s?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s==='all'?'전체':s==='active'?'진행중':'완료'}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={onlyOver100} onChange={e=>setOnlyOver100(e.target.checked)}
            className="w-4 h-4 rounded accent-green-700" />
          <span className="text-sm text-gray-700 font-medium">누적 100% 이상만</span>
        </label>

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">정렬</span>
          {(['date','pct'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortBy===s?'bg-green-700 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s==='date'?'계획일순':'달성률순'}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex-1 min-w-[200px]">
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder="부품명 · 품목코드 검색…"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700" />
        </div>

        <span className="text-sm text-gray-400">{filtered.length}건</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">데이터 없음</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">품목코드 / 색상</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">부품명</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">라인</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">계획일</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">계획 / 누적</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 w-48">달성률</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 w-32">완료 처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const cumGood = totals[p.id] ?? 0
                const pct = p.plan_qty > 0 ? Math.round(cumGood / p.plan_qty * 100) : 0
                const isOver = cumGood >= p.plan_qty && p.plan_qty > 0
                const bar = pct>=100?'bg-green-500':pct>=50?'bg-amber-400':'bg-gray-300'
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 ${p.status==='completed'?'bg-gray-50/60 opacity-60':''}`}>
                    <td className="px-5 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{p.item_code} / {p.color_code}</td>
                    <td className="px-5 py-3 text-xs text-gray-600 max-w-[220px]"><div className="truncate" title={p.item_name??''}>{p.item_name??'-'}</div></td>
                    <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">{p.production_line??'-'}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">{p.pack_plan_date}</td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <span className={`font-semibold text-base ${isOver?'text-green-700':'text-gray-700'}`}>{cumGood}</span>
                      <span className="text-gray-400 text-xs"> / {p.plan_qty}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bar}`} style={{width:`${Math.min(100,pct)}%`}} />
                        </div>
                        <span className={`text-xs font-bold w-12 text-right ${isOver?'text-green-700':'text-gray-500'}`}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleStatus(p)}
                        className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                          p.status==='completed'
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}>
                        {p.status === 'completed' ? '↩ 복구' : '✅ 완료 처리'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
