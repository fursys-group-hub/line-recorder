'use client'
import { useEffect, useState } from 'react'
type Material = { id:string; material_code:string; material_color:string; material_name:string; material_category:string; is_active:boolean }
const CATEGORIES = ['등받이','좌석','팔걸이','골조','기능부품','포장재료','소모품','부재료','기타']
const EMPTY = { material_code:'', material_name:'', material_category:'기타', material_color:'XX' }

export default function MaterialsPage() {
  const [materials,setMaterials]=useState<Material[]>([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [form,setForm]=useState({...EMPTY})
  const [editId,setEditId]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)
  const [filter,setFilter]=useState('ALL')

  useEffect(()=>{ load() },[])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/materials')
    const data = res.ok ? await res.json() : []
    setMaterials(data)
    setLoading(false)
  }

  async function save() {
    if(!form.material_code||!form.material_name){ alert('자재코드와 자재명은 필수입니다'); return }
    setSaving(true)
    if(editId) {
      await fetch('/api/materials', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:editId, ...form }),
      })
    } else {
      await fetch('/api/materials', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(form),
      })
    }
    setShowForm(false); setEditId(null); setForm({...EMPTY}); load(); setSaving(false)
  }

  function startEdit(m:Material){ setForm({material_code:m.material_code,material_name:m.material_name,material_category:m.material_category,material_color:m.material_color}); setEditId(m.id); setShowForm(true) }

  async function toggleActive(m:Material){
    await fetch('/api/materials', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id:m.id, is_active:!m.is_active }),
    })
    load()
  }

  const filtered=materials.filter(m=>filter==='ALL'||m.material_category===filter)
  const byCat=filtered.reduce((acc,m)=>{ const c=m.material_category||'기타'; if(!acc[c])acc[c]=[]; acc[c].push(m); return acc },{} as Record<string,Material[]>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-gray-900">자재코드 관리</h1>
        <button onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({...EMPTY})}} className="px-4 py-2 bg-green-800 text-white rounded-lg text-sm font-medium">{showForm?'취소':'+ 자재 추가'}</button>
      </div>
      {showForm&&(
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900 mb-4">{editId?'자재 수정':'신규 자재 등록'}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="block text-xs text-gray-500 mb-1">자재코드 *</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-700" placeholder="예) FAB-001" value={form.material_code} onChange={e=>setForm({...form,material_code:e.target.value})} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">자재명 *</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-700" placeholder="예) 등받이 패브릭" value={form.material_name} onChange={e=>setForm({...form,material_name:e.target.value})} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">자재색상</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="BK / WH / XX" value={form.material_color} onChange={e=>setForm({...form,material_color:e.target.value})} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">분류</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white" value={form.material_category} onChange={e=>setForm({...form,material_category:e.target.value})}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-green-800 text-white rounded-lg text-sm font-medium disabled:bg-gray-300">{saving?'저장 중...':(editId?'수정 저장':'등록')}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null)}} className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">취소</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {['ALL',...CATEGORIES].map(c=>(
          <button key={c} onClick={()=>setFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter===c?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c==='ALL'?'전체':c}
          </button>
        ))}
      </div>
      {loading?<div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>:(
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {Object.entries(byCat).map(([cat,mats])=>(
            <div key={cat}>
              <div className="px-4 py-2 bg-gray-50 border-b border-t border-gray-100"><span className="text-xs font-medium text-gray-500">{cat} ({mats.length})</span></div>
              {mats.map(m=>(
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 ${!m.is_active?'opacity-40':''}`}>
                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded w-28 text-center">{m.material_code}</span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{m.material_color}</span>
                  <span className="flex-1 text-sm text-gray-800">{m.material_name}</span>
                  <button onClick={()=>startEdit(m)} className="text-xs text-blue-600 hover:underline px-1">수정</button>
                  <button onClick={()=>toggleActive(m)} className={`text-xs px-2 py-1 rounded font-medium ${m.is_active?'text-green-700 bg-green-50 hover:bg-red-50 hover:text-red-600':'text-gray-500 bg-gray-100'}`}>{m.is_active?'활성':'비활성'}</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
