'use client'
import { useEffect, useState } from 'react'

const MODE_LABEL: Record<string,string> = { quick:'불량기록', lot:'로트마감' }
const MODE_CLS:  Record<string,string> = { quick:'bg-amber-100 text-amber-800', lot:'bg-blue-100 text-blue-800' }

function yc(p:number){ return p>=95?'text-green-700':p>=85?'text-amber-600':'text-red-600' }
function yb(p:number){ return p>=95?'bg-green-500':p>=85?'bg-amber-400':'bg-red-500' }
function fmtST(sec:number){ return `${Math.floor(sec/60)}분 ${sec%60}초` }
function fmtTime(iso:string){
  const d=new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function EditModal({ record, onClose, onSaved, onDeleted }: { record:any; onClose:()=>void; onSaved:(u:any)=>void; onDeleted:(id:string)=>void }) {
  const [f, setF] = useState({
    production_line: record.production_line??'',
    item_code:       record.item_code??'',
    color_code:      record.color_code??'',
    item_name:       record.item_name??'',
    input_qty:       record.input_qty??'',
    good_qty:        record.good_qty??'',
    defect_types:    record.defect_types??'',
    defect_materials:record.defect_materials??'',
    memo:            record.memo??'',
  })
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState(false)
  const [err,setErr]=useState('')
  const set=(k:string,v:string)=>setF(p=>({...p,[k]:v}))

  async function del(){
    if(!confirm('이 기록을 삭제하시겠습니까?\n삭제 후 되돌릴 수 없습니다.')) return
    setDeleting(true); setErr('')
    const res=await fetch(`/api/records?id=${record.id}`,{method:'DELETE'})
    const j=await res.json(); setDeleting(false)
    if(!j.ok){setErr(j.error??'삭제 실패');return}
    onDeleted(record.id)
  }

  async function save(){
    setSaving(true); setErr('')
    const body:any={id:record.id,...f,notify:true}
    const res=await fetch('/api/records',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    const j=await res.json(); setSaving(false)
    if(!j.ok){setErr(j.error??'저장 실패');return}
    const inp=Number(f.input_qty)||0,good=Number(f.good_qty)||0
    onSaved({...record,...f,
      input_qty:  f.input_qty!==''?inp:record.input_qty,
      good_qty:   f.good_qty!==''?good:record.good_qty,
      defect_qty: (f.input_qty!==''&&f.good_qty!=='')?inp-good:record.defect_qty,
      yield_pct:  inp>0?((good/inp)*100).toFixed(2):record.yield_pct,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{background:'rgba(0,0,0,0.6)'}}>
      <div className="absolute inset-0" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto" style={{maxHeight:'90vh'}}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">기록 수정</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl">×</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['production_line','생산라인'],['item_code','품목코드'],['color_code','색상코드'],['item_name','부품명']].map(([k,l])=>(
              <div key={k}>
                <label className="block text-xs text-gray-400 mb-1">{l}</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                  value={(f as any)[k]} onChange={e=>set(k,e.target.value)}/>
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 mb-1">투입 수량</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                value={f.input_qty} onChange={e=>set('input_qty',e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">양품 수량</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                value={f.good_qty} onChange={e=>set('good_qty',e.target.value)}/>
            </div>
          </div>
          {(f.input_qty!==''&&f.good_qty!=='')&&(
            <div className="mt-2 bg-gray-50 rounded-xl px-4 py-2 text-xs text-gray-500 flex gap-5">
              <span>불량 <b className="text-red-600">{Number(f.input_qty)-Number(f.good_qty)}</b></span>
              <span>수율 <b className={Number(f.input_qty)>0?yc(Number(f.good_qty)/Number(f.input_qty)*100):'text-gray-400'}>
                {Number(f.input_qty)>0?(Number(f.good_qty)/Number(f.input_qty)*100).toFixed(1)+'%':'-'}
              </b></span>
            </div>
          )}
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">불량유형</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                value={f.defect_types} onChange={e=>set('defect_types',e.target.value)} placeholder="예: 재봉불량, 오염"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">불량자재</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                value={f.defect_materials} onChange={e=>set('defect_materials',e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">메모</label>
              <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600 resize-none"
                value={f.memo} onChange={e=>set('memo',e.target.value)}/>
            </div>
          </div>
          {err&&<p className="text-xs text-red-500 mt-2 text-center">{err}</p>}
          <div className="flex gap-3 mt-5">
            <button onClick={del} disabled={deleting||saving}
              className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 disabled:opacity-50">
              {deleting?'삭제 중…':'삭제'}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium">취소</button>
            <button onClick={save} disabled={saving||deleting}
              className="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
              {saving?'저장 중…':'저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecordsPage() {
  const [records,  setRecords]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [dateFrom, setDateFrom] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().slice(0,10) })
  const [dateTo,   setDateTo]   = useState(()=>new Date().toISOString().slice(0,10))
  const [filterLine, setFilterLine] = useState('ALL')
  const [filterItem, setFilterItem] = useState('ALL')
  const [filterPhoto,setFilterPhoto]= useState(false)
  const [editRec,  setEditRec]  = useState<any>(null)

  useEffect(()=>{ load() },[dateFrom,dateTo,filterLine,filterItem,filterPhoto])

  async function load(){
    setLoading(true)
    const params = new URLSearchParams({ filter:'custom', dateFrom, dateTo })
    if(filterLine!=='ALL') params.set('line', filterLine)
    if(filterItem!=='ALL') params.set('item', filterItem)
    if(filterPhoto) params.set('hasPhoto', 'true')
    const res = await fetch(`/api/records?${params}`)
    const data = res.ok ? await res.json() : []
    setRecords(data)
    setLoading(false)
  }

  function handleSaved(u:any){
    setRecords(rs=>rs.map(r=>r.id===u.id?u:r))
  }

  function exportCsv(){
    if(records.length===0) return
    const headers = ['시각','모드','라인','품목코드','색상','부품명','투입','양품','불량','수율(%)','ST(초)','불량유형','불량자재','메모','사진URL','동영상']
    const modeLabel: Record<string,string> = { quick:'불량기록', lot:'로트마감' }
    const esc = (v:any) => {
      const s = v==null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
    }
    const rows = records.map(r=>{
      let videos:{url:string;desc:string}[]=[]
      if(r.video_url){ try{ videos=JSON.parse(r.video_url) }catch{ videos=[{url:r.video_url,desc:''}] } }
      const videoStr = videos.filter(v=>v.url).map(v=>`${v.desc||'영상'}: ${v.url}`).join(' | ')
      const t = new Date(r.recorded_at)
      const timeStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
      return [
        timeStr, modeLabel[r.mode]??r.mode, r.production_line, r.item_code, r.color_code, r.item_name,
        r.input_qty, r.good_qty, r.defect_qty,
        r.yield_pct!=null?parseFloat(r.yield_pct).toFixed(1):'',
        r.st_seconds, r.defect_types, r.defect_materials, r.memo,
        r.photo_urls, videoStr,
      ].map(esc).join(',')
    })
    const csv = '﻿' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `생산기록_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const allLines=Array.from(new Set(records.map(r=>r.production_line).filter(Boolean))).sort()
  const allItems=Array.from(new Set(records.map(r=>r.item_code).filter(Boolean))).sort()

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">시작일</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700"/>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">종료일</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-700"/>
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
        <label className="flex items-center gap-2 cursor-pointer ml-auto">
          <input type="checkbox" checked={filterPhoto} onChange={e=>setFilterPhoto(e.target.checked)} className="w-4 h-4 rounded accent-green-700"/>
          <span className="text-sm text-gray-600">사진 있는 기록만</span>
        </label>
        <button onClick={exportCsv} disabled={records.length===0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed">
          ⬇ 엑셀 다운로드
        </button>
      </div>

      {/* 기록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-800">기록 목록</h2>
          <span className="text-xs text-gray-400">{loading?'불러오는 중…':`총 ${records.length}건`}</span>
        </div>

        {loading && <div className="py-20 text-center text-gray-400 text-sm">불러오는 중…</div>}
        {!loading && records.length===0 && <div className="py-20 text-center text-gray-400 text-sm">해당 조건의 기록이 없습니다</div>}

        {!loading && records.length>0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{minWidth:'1200px'}}>
              <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 whitespace-nowrap">시각</th>
                  <th className="text-left px-4 py-3">모드</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">라인</th>
                  <th className="text-left px-4 py-3">품목코드</th>
                  <th className="text-left px-4 py-3">부품명</th>
                  <th className="text-right px-4 py-3">투입</th>
                  <th className="text-right px-4 py-3">양품</th>
                  <th className="text-right px-4 py-3">불량</th>
                  <th className="text-right px-4 py-3">수율</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">ST</th>
                  <th className="text-left px-4 py-3">불량유형</th>
                  <th className="text-left px-4 py-3">불량자재</th>
                  <th className="text-left px-4 py-3">메모</th>
                  <th className="text-center px-4 py-3">사진</th>
                  <th className="text-center px-4 py-3">동영상</th>
                  <th className="text-center px-4 py-3">수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(r=>{
                  const yld = r.yield_pct!=null ? parseFloat(r.yield_pct) : null
                  const photos = r.photo_urls ? r.photo_urls.split(',').map((u:string)=>u.trim()).filter(Boolean) : []
                  let videos:{url:string;desc:string}[]=[]
                  if(r.video_url){ try{ videos=JSON.parse(r.video_url) }catch{ videos=[{url:r.video_url,desc:''}] } }

                  return (
                    <tr key={r.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtTime(r.recorded_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${MODE_CLS[r.mode]??'bg-gray-100 text-gray-600'}`}>
                          {MODE_LABEL[r.mode]??r.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{r.production_line??'-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{r.item_code} / {r.color_code}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">
                        <div className="truncate" title={r.item_name??''}>{r.item_name??'-'}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.input_qty??'-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700 font-medium">{r.good_qty??'-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">{r.defect_qty??'-'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${yld!=null?yc(yld):'text-gray-300'}`}>
                        {yld!=null?`${yld.toFixed(1)}%`:'-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {r.st_seconds!=null?(
                          <span className="font-mono">{fmtST(r.st_seconds)}</span>
                        ):'-'}
                      </td>
                      <td className="px-4 py-3">
                        {r.defect_types?(
                          <div className="flex flex-wrap gap-1">
                            {r.defect_types.split(',').map((t:string,i:number)=>(
                              <span key={i} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded whitespace-nowrap">{t.trim()}</span>
                            ))}
                          </div>
                        ):'-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-orange-600 max-w-[160px]">
                        <div className="truncate" title={r.defect_materials??''}>{r.defect_materials??'-'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px]">
                        <div className="truncate italic" title={r.memo??''}>{r.memo??'-'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {photos.length>0?(
                          <div className="flex items-center justify-center gap-1">
                            {photos.slice(0,3).map((url:string,i:number)=>(
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="block w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-80 border border-gray-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="w-full h-full object-cover"
                                  onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                              </a>
                            ))}
                            {photos.length>3&&(
                              <span className="text-xs text-gray-400 font-medium">+{photos.length-3}</span>
                            )}
                          </div>
                        ):<span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {videos.length>0?(
                          <div className="flex flex-col gap-1">
                            {videos.map((v,i)=>(
                              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 whitespace-nowrap">
                                <span>▶</span>
                                <span className="max-w-[100px] truncate">{v.desc||`영상${i+1}`}</span>
                              </a>
                            ))}
                          </div>
                        ):<span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={()=>setEditRec(r)}
                          className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium transition-colors whitespace-nowrap">
                          수정
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editRec&&(
        <EditModal record={editRec} onClose={()=>setEditRec(null)}
          onSaved={r=>{ handleSaved(r); setEditRec(null) }}
          onDeleted={id=>{ setRecords(rs=>rs.filter(r=>r.id!==id)); setEditRec(null) }}/>
      )}
    </div>
  )
}
