import { backupSchema, type Data } from './model'
const DB='nurse-interview-lab-v1'
function open():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1); r.onupgradeneeded=()=>r.result.createObjectStore('data'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.onblocked=()=>reject(new Error('다른 탭이 저장소를 사용 중입니다.'))}) }
/** Save again if in-memory data changed while an IndexedDB transaction was pending. */
export async function saveLatest(read:()=>Data, write:(data:Data)=>Promise<void>):Promise<void> {
 let snapshot:Data
 do { snapshot=read(); await write(snapshot) } while(snapshot!==read())
}

/** Shared persistence boundary; revision is stored separately so v0.5 backups stay readable. */
export interface DataRepository {
 read():Promise<{data:Data|null,revision:number,mode:'active'|'paused'|'disabled'|null}>
 write(data:Data,expected:number,allowPaused?:boolean):Promise<number>
 pause(expected:number):Promise<number>
 remove(expected:number):Promise<number>
}
export class StorageConflict extends Error { constructor(){super('다른 탭에서 저장 데이터가 변경되었습니다. 현재 내용을 백업하고 새로고침하세요.')} }
export const indexedDBRepository:DataRepository={
 async read(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly'), store=tx.objectStore('data'), value=store.get('backup'), revision=store.get('revision'), mode=store.get('mode');tx.oncomplete=()=>{db.close();try{resolve({data:value.result===undefined?null:backupSchema.parse(value.result),revision:typeof revision.result==='number'?revision.result:0,mode:['active','paused','disabled'].includes(mode.result)?mode.result:null})}catch(e){reject(e)}};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error||new Error('읽기 중단'))}})},
 async write(data,expected,allowPaused=false){return compareAndMutate(expected,s=>s.put(data,'backup'),'active',allowPaused)},
 async pause(expected){return compareAndMutate(expected,()=>{},'paused',false)},
 async remove(expected){return compareAndMutate(expected,s=>s.delete('backup'),'disabled',true)}
}
async function compareAndMutate(expected:number,change:(store:IDBObjectStore)=>void,mode:'active'|'paused'|'disabled',allowPaused:boolean):Promise<number>{
 const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),get=store.get('revision'),state=store.get('mode');let conflict=false;state.onsuccess=()=>{const current=typeof get.result==='number'?get.result:0;if(current!==expected||(!allowPaused&&(state.result==='paused'||state.result==='disabled'))){conflict=true;tx.abort();return}change(store);store.put(current+1,'revision');store.put(mode,'mode')};tx.oncomplete=()=>{db.close();resolve(expected+1)};tx.onerror=()=>{db.close();reject(tx.error||new Error('저장 실패'))};tx.onabort=()=>{db.close();reject(conflict?new StorageConflict():tx.error||new Error('저장 중단'))}})
}
