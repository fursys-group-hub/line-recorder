'use client'
import { useEffect, useState } from 'react'

function yc(p:number){ return p>=95?'text-green-700':p>=85?'text-amber-600':'text-red-600' }
function yb(p:number){ return p>=95?'bg-green-500':p>=85?'bg-amber-400':'bg-red-500' }

export default function DashboardPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => { const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().slice(0,10) })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0,10))
  const [filterLine, setFilterLine] = useState('ALL')
  const [filterItem, setFilterItem] = useState('ALL')
  const [groupBy, setGroupBy] = useState<'item'|'line'|'date'>('item')
  const [storage, setStorage] = useState<{bucket:string;file_count:number;total_bytes:number}[]|null>(null)

  useEffect(() => { load() }, [dateFrom, dateTo, filterLine, filterItem])
  useEffect(() => { loadStorage() }, [])

  async function loadStorage() {
    const res = await fetch('/api/dashboard/storage')
    if (res.ok) { const data = await res.json(); setStorage(data) }
  }

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ filter:'custom', dateFrom, dateTo, limit:'1000' })
    if (filterLine !== 'ALL') params.set('line', filterLine)
    if (filterItem !== 'ALL') params.set('item', filterItem)
    const res = await fetch(`/api/records?${params}`)
    const data = res.ok ? await res.json() : []
    setRecords(data)
    setLoading(false)
  }

  const allLines = Array.from(new Set(records.map(r=>r.production_line).filter(Boolean))).sort()
  const allItems = Array.from(new Set(records.map(r=>r.item_code).filter(Boolean))).sort()

  const grouped: Record<string,{input:number;good:number;defect:number;dt:Record<string,number>}> = {}
  records.forEach(r => {
    const key = groupBy==='item' ? `${r.item_code} / ${r.color_code}`
              : groupBy==='line' ? (r.production_line??'미지정')
              : new Date(r.recorded_at).toLocaleDateString('ko-KR')
    if (!grouped[key]) grouped[key] = { input:0, good:0, defect:0, dt:{} }
    grouped[key].input  += r.input_qty??0
    grouped[key].good   += r.good_qty??0
    grouped[key].defect += r.defect_qty??0
    if (r.defect_types) r.defect_types.split(',').forEach((t:string)=>{
      const k=t.trim(); if(k) grouped[key].dt[k]=(grouped[key].dt[k]??0)+1
    })
  })

  const dateRows: Record<string,{input:number;good:number;defect:number}> = {}
  records.forEach(r => {
    const d = new Date(r.recorded_at).toLocaleDateString('ko-KR')
    if (!dateRows[d]) dateRows[d]={input:0,good:0,defect:0}
    dateRows[d].input  += r.input_qty??0
    dateRows[d].good   += r.good_qty??0
    dateRows[d].defect += r.defect_qty??0
  })

  const tot = records.reduce((a,r)=>({ input:a.input+(r.input_qty??0), good:a.good+(r.good_qty??0), defect:a.defect+(r.defect_qty??0) }), {input:0,good:0,defect:0})
  const totYld = tot.input>0 ? tot.good/tot.input*100 : 0

  const fmtMB = (b:number) => b >= 1024*1024*1024 ? (b/1024/1024/1024).toFixed(2)+' GB' : (b/1024/1024).toFixed(0)+' MB'
  const storageTotal = storage ? storage.reduce((a,s)=>a+Number(s.total_bytes),0) : 0
  const storageFiles = storage ? storage.reduce((a,s)=>a+Number(s.file_count),0) : 0
  const storagePct = Math.min(100, storageTotal/(10*1024*1024*1024)*100)

  return (
    <div className="space-y-5">
      {/* 스토리지 사용량 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-gray-800">스토리지 사용량</h2>
            <span className="text-xs text-gray-400">(사진 실제 용량)</span>
          </div>
          <div className="text-sm">
            <span className={`font-bold ${storageTotal < 10*1024*1024*1024 ? 'text-green-700' : 'text-red-600'}`}>{fmtMB(storageTotal)}</span>
            <span className="text-gray-400"> / 10 GB · {storageFiles.toLocaleString()}장</span>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full ${storagePct<80?'bg-green-500':storagePct<95?'bg-amber-400':'bg-red-500'}`} style={{width:`${storagePct}%`}} />
        </div>
        {storage && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {[...storage].sort((a,b)=>Number(b.total_bytes)-Number(a.total_bytes)).map(s=>(
              <span key={s.bucket}>{s.bucket} <b className="text-gray-700">{fmtMB(Number(s.total_bytes))}</b> ({Number(s.file_count).toLocaleString()})</span>
            ))}
          </div>
        )}
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">시작일</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">종료일</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">라인</label>
          <select value={filterLine} onChange={e=>setFilterLine(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[160px] focus:outline-none">
            <option value="ALL">전체 라인</option>
            {allLines.map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">품목코드</label>
          <select value={filterItem} onChange={e=>setFilterItem(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[200px] focus:outline-none">
            <option value="ALL">전체 품목</option>
            {allItems.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-1.5">
          {([['item','품목별'],['line','라인별'],['date','날짜별']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setGroupBy(k)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${groupBy===k?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 합계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:'총 투입', val:tot.input.toLocaleString(), unit:'개', cls:'text-gray-900' },
          { label:'총 양품', val:tot.good.toLocaleString(),  unit:'개', cls:'text-green-700' },
          { label:'총 불량', val:tot.defect.toLocaleString(),unit:'개', cls:'text-red-600' },
          { label:'평균 수율', val:totYld.toFixed(1), unit:'%', cls:yc(totYld) },
        ].map(c=>(
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm text-center">
            <div className={`text-3xl font-semibold ${c.cls}`}>{c.val}<span className="text-base ml-1">{c.unit}</span></div>
            <div className="text-xs text-gray-400 mt-1.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 집계 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-800">
            {groupBy==='item'?'품목별':groupBy==='line'?'라인별':'날짜별'} 생산 집계
          </h2>
          <span className="text-xs text-gray-400">{loading?'불러오는 중…':`${records.length}건`}</span>
        </div>
        {!loading && Object.keys(grouped).length>0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
              <tr>
                <th className="text-left px-5 py-3">구분</th>
                <th className="text-right px-5 py-3">투입</th>
                <th className="text-right px-5 py-3">양품</th>
                <th className="text-right px-5 py-3">불량</th>
                <th className="text-right px-5 py-3 w-28">수율</th>
                <th className="px-5 py-3 w-48">수율 바</th>
                <th className="px-5 py-3">주요 불량</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(grouped).sort((a,b)=>b[1].input-a[1].input).map(([key,s])=>{
                const yld = s.input>0 ? s.good/s.input*100 : 0
                const top = Object.entries(s.dt).sort((a,b)=>b[1]-a[1]).slice(0,4)
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-800 font-medium">{key}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.input.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-green-700 font-medium">{s.good.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-red-600">{s.defect.toLocaleString()}</td>
                    <td className={`px-5 py-3 text-right text-base font-bold ${yc(yld)}`}>{yld.toFixed(1)}%</td>
                    <td className="px-5 py-3">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${yb(yld)}`} style={{width:`${Math.min(100,yld)}%`}} />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {top.map(([t,n])=>(
                          <span key={t} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{t} <b>{n}</b></span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && Object.keys(grouped).length===0 && (
          <div className="py-16 text-center text-gray-400 text-sm">해당 기간에 데이터가 없습니다</div>
        )}
      </div>

      {/* 날짜별 소계 */}
      {Object.keys(dateRows).length>0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">날짜별 소계</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
              <tr>
                <th className="text-left px-5 py-3">날짜</th>
                <th className="text-right px-5 py-3">투입</th>
                <th className="text-right px-5 py-3">양품</th>
                <th className="text-right px-5 py-3">불량</th>
                <th className="text-right px-5 py-3">수율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(dateRows).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,s])=>{
                const yld = s.input>0 ? s.good/s.input*100 : 0
                return (
                  <tr key={date} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-gray-700">{date}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">{s.input.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-green-700">{s.good.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-red-600">{s.defect.toLocaleString()}</td>
                    <td className={`px-5 py-2.5 text-right font-bold ${yc(yld)}`}>{yld.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
