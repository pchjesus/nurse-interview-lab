/// <reference types="vite/client" />
import type {SupabaseClient} from '@supabase/supabase-js'

const projectHost='aevhsdqrirgslfetknip.supabase.co'
type Settings={VITE_SUPABASE_URL?:unknown;VITE_SUPABASE_PUBLISHABLE_KEY?:unknown}
type Configuration={status:'ready';url:string;publishableKey:string}|{status:'unconfigured'|'invalid';reason:string}
export type InactiveClient={status:'initialized';client:SupabaseClient}|{status:'unconfigured'|'invalid';reason:string}

/** Validates only public configuration; error messages never include supplied values. */
export function validateSupabaseSettings(env:Settings):Configuration {
 const rawUrl=typeof env.VITE_SUPABASE_URL==='string'?env.VITE_SUPABASE_URL.trim():''
 const key=typeof env.VITE_SUPABASE_PUBLISHABLE_KEY==='string'?env.VITE_SUPABASE_PUBLISHABLE_KEY.trim():''
 if(!rawUrl&&!key)return {status:'unconfigured',reason:'서버 설정이 없습니다.'}
 if(!rawUrl||!key)return {status:'unconfigured',reason:'프로젝트 URL과 공개 키가 모두 필요합니다.'}
 try{
  const url=new URL(rawUrl)
  if(url.protocol!=='https:'||url.hostname!==projectHost||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return {status:'invalid',reason:'Nurse Interview Lab 전용 HTTPS 프로젝트 URL을 확인하세요.'}
  if(!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key))return {status:'invalid',reason:'Supabase publishable 공개 키가 필요합니다. 비밀 키나 service_role 키를 사용하지 마세요.'}
  return {status:'ready',url:url.origin,publishableKey:key}
 }catch{return {status:'invalid',reason:'유효한 프로젝트 URL을 입력하세요.'}}
}

/** Explicit, inactive construction only. No app entry point calls this function. */
export async function createInactiveSupabaseClient(env:Settings={VITE_SUPABASE_URL:import.meta.env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}):Promise<InactiveClient>{
 const config=validateSupabaseSettings(env)
 if(config.status!=='ready')return config
 const {createClient}=await import('@supabase/supabase-js')
 const client=createClient(config.url,config.publishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,skipAutoInitialize:true},
  global:{fetch:async()=>{throw new Error('서버 연결 기능이 비활성화되어 있습니다.')}}
 })
 return {status:'initialized',client}
}

/** Created only after an explicit OTP request. All non-auth HTTP paths are denied. */
export async function createEmailOtpClient(env:Settings={VITE_SUPABASE_URL:import.meta.env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},fetchImpl:typeof fetch=globalThis.fetch):Promise<{status:'initialized';client:SupabaseClient;abort:()=>void}|{status:'unconfigured'|'invalid';reason:string}>{
 const config=validateSupabaseSettings(env)
 if(config.status!=='ready')return config
 const controller=new AbortController()
 const authFetch:typeof fetch=async(input,init)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()
  const pathAllowed=target.pathname==='/auth/v1/otp'||target.pathname==='/auth/v1/verify'||target.pathname==='/auth/v1/logout'
  const paramsAllowed=target.pathname==='/auth/v1/logout'?(target.search===''||target.search==='?scope=local'):target.search===''
  if(target.origin!==config.url||!pathAllowed||!paramsAllowed||method!=='POST')throw new Error('허용되지 않은 서버 요청입니다.')
  const requestController=new AbortController();const signals=[controller.signal,init?.signal,input instanceof Request?input.signal:undefined].filter((signal):signal is AbortSignal=>!!signal);const abort=()=>requestController.abort();for(const signal of signals){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})}const timeout=setTimeout(abort,15000);try{return await fetchImpl(input,{...init,signal:requestController.signal,redirect:'error'})}finally{clearTimeout(timeout);for(const signal of signals)signal.removeEventListener('abort',abort)}
 }
 const {createClient}=await import('@supabase/supabase-js')
 const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,skipAutoInitialize:true,storageKey:`nurse-interview-auth-${crypto.randomUUID()}`},global:{fetch:authFetch}})
 return {status:'initialized',client,abort:()=>{controller.abort();void client.auth.dispose()}}
}
