import { backupSchema, type Data } from './model'
const DB='nurse-interview-lab-v1'
function open():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1); r.onupgradeneeded=()=>r.result.createObjectStore('data'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.onblocked=()=>reject(new Error('다른 탭이 저장소를 사용 중입니다.'))}) }
async function transaction(mode:IDBTransactionMode, action:(s:IDBObjectStore)=>IDBRequest) { const db=await open(); return new Promise<unknown>((resolve,reject)=>{ const tx=db.transaction('data',mode); const req=action(tx.objectStore('data')); tx.oncomplete=()=>{db.close();resolve(req.result)}; tx.onerror=()=>{db.close();reject(tx.error)}; tx.onabort=()=>{db.close();reject(tx.error)} }) }
export async function load():Promise<Data|null> { const value=await transaction('readonly',s=>s.get('backup')); return value===undefined ? null : backupSchema.parse(value) }
export async function save(data:Data) { await transaction('readwrite',s=>s.put(data,'backup')) }
export async function clear() { await transaction('readwrite',s=>s.delete('backup')) }

/** Save again if in-memory data changed while an IndexedDB transaction was pending. */
export async function saveLatest(read:()=>Data, write:(data:Data)=>Promise<void> = save):Promise<void> {
 let snapshot:Data
 do { snapshot=read(); await write(snapshot) } while(snapshot!==read())
}
