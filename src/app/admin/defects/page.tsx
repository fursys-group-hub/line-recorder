'use client'
import { useEffect, useState } from 'react'

const STATUS = [
  { key:'진행', cls:'bg-blue-100 text-blue-700 border-blue-300', dot:'bg-blue-500' },
  { key:'종결', cls:'bg-green-100 text-green-700 border-green-300', dot:'bg-green-500' },
  { key:'보류', cls:'bg-amber-100 text-amber-700 border-amber-300', dot:'bg-amber-500' },
]
function statusMeta(s:string|null){ return STATUS.find(x=>x.key===s) ?? null }

function fmtTime(iso:string){
  const d=new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function DefectCard({ rec, onSaved }: { rec:any; onSaved:(u:any)=>void }) {
  const [status, setStatus] = useState<string>(rec.review_status ?? '')
  const [due, setDue]       = useState<string>(rec.improve_due ?? '')
  const [comment, setComment] = useState<string>(rec.review_comment ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const photos = rec.photo_urls ? rec.photo_urls.split(',').map((u:string)=>u.trim()).filter(Boolean) : []
  const dirty = status!==(rec.review_status??'') || due!==(rec.improve_due??'') || comment!==(rec.review_comment??'')

  async function save(){
    setSaving(true); setSaved(false)
    const res = await fetch('/api/records', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id:rec.id, review_status:status||null, improve_due:due||null, review_comment:comment||null }),
    })
    const j = await res.json()
    setSaving(false)
    if(j.ok){ setSaved(true); onSaved({...rec, review_status:status||null, improve_due:due||null, review_comment:comment||null }); setTimeout(()=>setSaved(false),1500) }
    else alert('저장 실패: '+(j.error??''))
  }

  const meta = statusMeta(status)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col lg:flex-row">
      <div className="flex-1 p-5 border-b lg:border-b-0 lg:border-r border-gray-100">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">불량기록</span>
          <span className="text-sm font-medium text-gray-800">{rec.production_line ?? '-'}</span>
          <span className="text-xs text-gray-400">{fmtTime(rec.recorded_at)}</span>
          {meta && <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium border ${meta.cls}`}>{meta.key}</span>}
        </div>
        <div className="font-mono text-sm text-gray-700">{rec.item_code} / {rec.color_code}</div>
        {rec.item_name && <div className="text-sm text-gray-600 mt-0.5">{rec.item_name}</div>}

        <div className="flex gap-4 mt-2.5 text-sm flex-wrap">
          {rec.defect_qty!=null && <span className="text-gray-500">불량수량 <b className="text-red-600">{rec.defect_qty}</b></span>}
          {rec.defect_types && <span className="text-gray-500">유형 <b className="text-red-600">{rec.defect_types}</b></span>}
        </div>
        {rec.defect_materials && <div className="text-sm text-orange-600 mt-1">불량자재: {rec.defect_materials}</div>}
        {rec.memo && <div className="text-sm text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{rec.memo}</div>}

        {photos.length>0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {photos.map((url:string,i:number)=>(
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="block w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:opacity-80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="lg:w-96 flex-shrink-0 p-5 bg-gray-50/60">
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">상태</label>
          <div className="flex gap-2">
            {STATUS.map(s=>(
              <button key={s.key} onClick={()=>setStatus(status===s.key?'':s.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${status===s.key?s.cls:'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                {s.key}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">개선 일정</label>
          <input type="date" value={due} onChange={e=>setDue(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700 bg-white" />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">코멘트</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4}
            placeholder="회의 내용 · 조치 사항 · 담당자 등…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-700 resize-none bg-white" />
        </div>

        <button onClick={save} disabled={saving||!dirty}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${saved?'bg-green-600 text-white':dirty?'bg-green-700 text-white hover:bg-green-800':'bg-gray-200 text-gray-400'}`}>
          {saving?'저장 중…':saved?'✓ 저장됨':dirty?'저장':'변경 없음'}
        </button>
      </div>
    </div>
  )
}

export default function DefectsPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10) })
  const [dateTo,   setDateTo]   = useState(()=>new Date().toISOString().slice(0,10))
  const [filterLine, setFilterLine] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')

  useEffect(()=>{ load() },[dateFrom,dateTo])

  async function load(){
    setLoading(true)
    const params = new URLSearchParams({ filter:'custom', dateFrom, dateTo, mode:'quick' })
    const res = await fetch(`/api/records?${params}`)
    const data = res.ok ? await res.json() : []
    setRecords(data)
    setLoading(false)
  }

  function handleSaved(u:any){ setRecords(rs=>rs.map(r=>r.id===u.id?u:r)) }

  const allLines = Array.from(new Set(records.map(r=>r.production_line).filter(Boolean))).sort()
  const filtered = records.filter(r=>{
    if(filterLine!=='ALL' && r.production_line!==filterLine) return false
    if(filterStatus==='ALL') return true
    if(filterStatus==='미지정') return !r.review_status
    return r.review_status===filterStatus
  })

  const counts = {
    전체: records.length,
    진행: records.filter(r=>r.review_status==='진행').length,
    종결: records.filter(r=>r.review_status==='종결').length,
    보류: records.filter(r=>r.review_status==='보류').length,
    미지정: records.filter(r=>!r.review_status).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">불량 관리 · 개선 회의</h1>
        <span className="text-sm text-gray-400">{loading?'불러오는 중…':`총 ${filtered.length}건`}</span>
      </div>

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
        <div className="flex gap-1.5 ml-auto">
          {(['ALL','진행','종결','보류','미지정'] as const).map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus===s?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s==='ALL'?'전체':s} {s==='ALL'?counts.전체:(counts as any)[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">불러오는 중…</div>
      ) : filtered.length===0 ? (
        <div className="py-20 text-center text-gray-400 text-sm">해당 조건의 불량 기록이 없습니다</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r=> <DefectCard key={r.id} rec={r} onSaved={handleSaved} />)}
        </div>
      )}
    </div>
  )
}
