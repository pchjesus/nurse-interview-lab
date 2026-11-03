import {createClient} from '@supabase/supabase-js'
import {z} from 'zod'
import {backupSchema} from '../model'
import {SupabaseCloudTransport, type MemorySessionBinding} from './supabaseTransport'
import {validateSupabaseSettings} from './supabase'

/** Pure policy: exposed for isolated tests, never sends requests or receives credentials. */
export function isPermittedDataRequest(origin:string,rawUrl:string,method:string,owner:string,body:unknown):boolean {
 try{
  const url=new URL(rawUrl)
  if(url.origin!==origin||url.username||url.password||url.hash)return false
  if(url.pathname==='/rest/v1/nurse_backups'&&method==='GET')return [...url.searchParams.keys()].length===2&&url.searchParams.getAll('owner_id').length===1&&url.searchParams.get('owner_id')===`eq.${owner}`&&url.searchParams.getAll('select').length===1&&url.searchParams.get('select')==='owner_id,format_version,revision,backup,updated_at'
  if(url.pathname!=='/rest/v1/rpc/save_nurse_backup'||method!=='POST'||url.search||typeof body!=='string')return false
  const parsed:unknown=JSON.parse(body)
  const schema=z.object({p_expected_owner_id:z.literal(owner),p_expected_revision:z.number().int().positive().safe().lt(Number.MAX_SAFE_INTEGER).nullable(),p_format_version:z.literal('1.0'),p_backup:backupSchema}).strict()
  return schema.safeParse(parsed).success
 }catch{return false}
}
type VerifiedSession={user:{id:string};access_token:string;expires_at:number}
/** Isolated preparation factory: callers must explicitly inject a fetch implementation. */
export function createIsolatedSessionBroker(settings:{VITE_SUPABASE_URL:string;VITE_SUPABASE_PUBLISHABLE_KEY:string}, transportFetch:typeof fetch){
 const config=validateSupabaseSettings(settings)
 if(config.status!=='ready')throw new Error('유효한 공개 프로젝트 설정이 필요합니다.')
 let token:string|null=null, binding:MemorySessionBinding|null=null, generation=0
 const active=new Set<AbortController>()
 const clear=()=>{generation++;token=null;binding=null;for(const controller of active)controller.abort();active.clear()}
 const current=()=>binding&&binding.expiresAt>Date.now()?{...binding}:null
 const getToken=async()=>current()&&token?token:null
 const guardedFetch:typeof fetch=async(input,init)=>{
  const s=current(), secret=token
  if(!s||!secret)throw new Error('세션이 없습니다.')
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined))
  if(headers.get('Authorization')!==`Bearer ${secret}`||!isPermittedDataRequest(config.url,url.href,method,s.userId,init?.body))throw new Error('차단된 요청입니다.')
  const controller=new AbortController();active.add(controller)
  const signals=[init?.signal,input instanceof Request?input.signal:undefined].filter((v):v is AbortSignal=>!!v)
  const abort=()=>controller.abort();for(const signal of signals){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})}
  try{if(controller.signal.aborted)throw new Error('요청이 취소됐습니다.');const result=await transportFetch(input,{...init,signal:controller.signal,redirect:'error'});const end=current();if(!end||end.userId!==s.userId||end.generation!==s.generation)throw new Error('세션이 변경됐습니다.');return result}
  finally{active.delete(controller);for(const signal of signals)signal.removeEventListener('abort',abort)}
 }
 const client=createClient(config.url,config.publishableKey,{accessToken:getToken,global:{fetch:guardedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,skipAutoInitialize:true}})
 const transport=new SupabaseCloudTransport(client,current)
 return {
  /** Accept only a session already verified by the server's OTP response. JWT decoding below is not signature verification. */
  approve(session:VerifiedSession){
   clear()
   try{
    const parts=session.access_token.split('.');if(parts.length!==3)throw Error()
    const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))) as Record<string,unknown>
    const expiry=Math.min(session.expires_at,typeof payload.exp==='number'?payload.exp:0)*1000
    if(!z.string().uuid().safeParse(session.user.id).success||payload.sub!==session.user.id||payload.role!=='authenticated'||payload.is_anonymous!==false||!Number.isFinite(expiry)||expiry<=Date.now())throw Error()
    token=session.access_token;binding={userId:session.user.id,expiresAt:expiry,generation:String(generation)}
   }catch{throw new Error('인증 세션을 확인하지 못했습니다.')}
  },
  logout:clear,
  session:current,
  transport,
 }
}
