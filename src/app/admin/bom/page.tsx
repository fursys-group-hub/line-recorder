'use client'
import { useEffect, useState } from 'react'
type Material = { id:string; material_code:string; material_color:string; material_name:string; material_category:string }
type BomRow = { id:string; material_id:string; quantity:number; is_active:boolean; materials:Material }

export default function BomPage() {
  const [products,setProducts]=useState<any[]>([])
  const [materials,setMaterials]=useState<Material[]>([])
  const [selProduct,setSelProduct]=useState<string>('')
  const [bom,setBom]=useState<BomRow[]>([])
  const [loading,setLoading]=useState(false)
  const [addMatId,setAddMatId]=useState(''); const [addQty,setAddQty]=useState(1); const [saving,setSaving]=useState(false)

  useEffect(()=>{ loadProducts(); loadMaterials() },[])
  useEffect(()=>{ if(selProduct) loadBom(selProduct) },[selProduct])

  async function loadProducts() {
    const res = await fetch('/api/bom?products=true')
    const data = res.ok ? await res.json() : []
    const unique = Array.from(new Map(data.map((r:any)=>[`${r.item_code}::${r.color_code}`,r])).values()) as any[]
    setProducts(unique)
    if(unique.length>0) setSelProduct(`${unique[0].item_code}::${unique[0].color_code}`)
  }

  async function loadMaterials() {
    const res = await fetch('/api/materials')
    const data = res.ok ? await res.json() : []
    setMaterials(data.filter((m:any) => m.is_active !== false))
  }

  async function loadBom(key:string) {
    setLoading(true); const [ic,cc]=key.split('::')
    const res = await fetch(`/api/bom?item_code=${encodeURIComponent(ic)}&color_code=${encodeURIComponent(cc)}&full=true`)
    const data = res.ok ? await res.json() : []
    setBom(data as BomRow[]); setLoading(false)
  }

  async function addBomItem() {
    if(!addMatId||!selProduct) return; setSaving(true)
    const [ic,cc]=selProduct.split('::')
    await fetch('/api/bom', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ item_code:ic, color_code:cc, material_id:addMatId, quantity:addQty }),
    })
    setAddMatId(''); setAddQty(1); loadBom(selProduct); setSaving(false)
  }

  async function toggleActive(item:BomRow) {
    await fetch('/api/bom', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id:item.id, is_active:!item.is_active }),
    })
    loadBom(selProduct)
  }

  async function deleteBomItem(id:string) {
    if(!confirm('삭제?'))return
    await fetch(`/api/bom?id=${id}`, { method:'DELETE' })
    loadBom(selProduct)
  }

  const bomByCat=bom.reduce((acc,b)=>{ const cat=b.materials?.material_category||'기타'; if(!acc[cat])acc[cat]=[]; acc[cat].push(b); return acc },{} as Record<string,BomRow[]>)
  const existingMatIds=bom.map(b=>b.material_id)

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-medium text-gray-900">BOM 관리</h1>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">제품 선택</p>
        <div className="flex flex-wrap gap-2">
          {products.map(p=>{
            const key=`${p.item_code}::${p.color_code}`
            return <button key={key} onClick={()=>setSelProduct(key)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${selProduct===key?'bg-green-800 border-green-800 text-white':'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
              {p.item_code} / {p.color_code}
            </button>
          })}
        </div>
      </div>
      {selProduct&&(
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div><h2 className="text-sm font-medium text-gray-900">{selProduct} BOM</h2><p className="text-xs text-gray-400 mt-0.5">{bom.filter(b=>b.is_active).length}개 자재</p></div>
            </div>
            {loading?<div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
            :bom.length===0?<div className="text-center py-8 text-gray-400 text-sm">등록된 BOM 없음</div>:(
              <div>{Object.entries(bomByCat).map(([cat,items])=>(
                <div key={cat}>
                  <div className="px-4 py-2 bg-gray-50 border-b border-t border-gray-100"><span className="text-xs font-medium text-gray-500">{cat}</span></div>
                  {items.map(item=>(
                    <div key={item.id} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 ${!item.is_active?'opacity-40':''}`}>
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-28 text-center">{item.materials?.material_code}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.materials?.material_color}</span>
                      <span className="flex-1 text-sm text-gray-800">{item.materials?.material_name}</span>
                      <span className="text-xs text-gray-400">×{item.quantity}</span>
                      <button onClick={()=>toggleActive(item)} className={`text-xs px-2 py-1 rounded-lg font-medium ${item.is_active?'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600':'bg-gray-100 text-gray-500'}`}>{item.is_active?'활성':'비활성'}</button>
                      <button onClick={()=>deleteBomItem(item.id)} className="text-xs text-gray-400 hover:text-red-600 px-1">삭제</button>
                    </div>
                  ))}
                </div>
              ))}</div>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">자재 추가</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white" value={addMatId} onChange={e=>setAddMatId(e.target.value)}>
                  <option value="">— 자재 선택 —</option>
                  {materials.filter(m=>!existingMatIds.includes(m.id)).reduce((acc:any[],m)=>{
                    const cat=m.material_category||'기타'; let g=acc.find((x:any)=>x.label===cat); if(!g){g={label:cat,items:[]}; acc.push(g)}; g.items.push(m); return acc
                  },[]).map((g:any)=>g.items.length>0&&<optgroup key={g.label} label={g.label}>{g.items.map((m:any)=><option key={m.id} value={m.id}>{m.material_code} — {m.material_name} [{m.material_color}]</option>)}</optgroup>)}
                </select>
              </div>
              <div className="w-20"><input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={addQty} min={1} onChange={e=>setAddQty(parseInt(e.target.value)||1)} /></div>
              <button onClick={addBomItem} disabled={!addMatId||saving} className="px-4 py-2 bg-green-800 text-white rounded-lg text-sm font-medium disabled:bg-gray-300">{saving?'...':'추가'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
