import type {SupabaseClient} from '@supabase/supabase-js'
import {z} from 'zod'
import {backupSchema, type Data} from '../model'
import {CloudError, type CloudRecord, type CloudTransport} from './repository'

/** No tokens: generation must change on sign-in, sign-out and account replacement. */
export interface MemorySessionBinding {userId:string; expiresAt:number; generation:string}
type Kind='permission-denied'|'network'|'timeout'|'invalid-response'|'session-changed'|'authentication'|'conflict'|'invalid-input'
export class SupabaseTransportError extends CloudError {
 constructor(code:CloudError['code'], public readonly kind:Kind, message:string){super(code,message);this.name='SupabaseTransportError'}
}
type Client=Pick<SupabaseClient,'from'|'rpc'>
const rowSchema=z.object({owner_id:z.string().uuid(),format_version:z.literal('1.0'),revision:z.number().int().positive().safe(),updated_at:z.string().datetime({offset:true}),backup:z.unknown()})
const fail=(code:CloudError['code'],kind:Kind,message:string):never=>{throw new SupabaseTransportError(code,kind,message)}
function canonical(value:unknown):string {
 const visit=(v:unknown):unknown=>Array.isArray(v)?v.map(visit):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,visit((v as Record<string,unknown>)[k])])):v
 return JSON.stringify(visit(value))
}
/** Preparation only. Not imported by the app; never creates a client or initiates authentication. */
export class SupabaseCloudTransport implements CloudTransport {
 private timeoutMs:number
 constructor(private client:Client,private memorySession:()=>MemorySessionBinding|null,options:{timeoutMs?:number;now?:()=>number}={}){
  this.timeoutMs=options.timeoutMs??15000;this.now=options.now??Date.now
  if(!Number.isFinite(this.timeoutMs)||this.timeoutMs<=0)throw new Error('유효한 요청 제한 시간이 필요합니다.')
 }
 private now:()=>number
 async session():Promise<{userId:string}|null>{const s=this.memorySession();return s&&z.string().uuid().safeParse(s.userId).success&&Number.isFinite(s.expiresAt)&&s.expiresAt>this.now()&&s.generation?{userId:s.userId}:null}
 private binding(owner:string):MemorySessionBinding {
  const s=this.memorySession()
  if(!s||!z.string().uuid().safeParse(s.userId).success||!Number.isFinite(s.expiresAt)||s.expiresAt<=this.now()||!s.generation)return fail('unauthenticated','authentication','유효한 로그인이 필요합니다.')
  if(s.userId!==owner)return fail('ownership','session-changed','요청 소유자와 로그인 계정이 다릅니다.')
  return {...s}
 }
 private unchanged(start:MemorySessionBinding,write:boolean){
  const s=this.memorySession()
  if(!s||s.userId!==start.userId||s.generation!==start.generation||!Number.isFinite(s.expiresAt)||s.expiresAt<=this.now())fail(write?'unconfirmed':'ownership','session-changed',write?'저장 중 인증 상태가 변경되어 결과가 미확정입니다.':'조회 중 인증 상태가 변경되었습니다.')
 }
 private async request(start:MemorySessionBinding,write:boolean,run:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown;status:number}>):Promise<unknown>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined
  try{
   const response=await Promise.race([Promise.resolve().then(()=>{this.unchanged(start,false);return run(controller.signal)}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new SupabaseTransportError(write?'unconfirmed':'invalid-data','timeout',write?'저장 요청 시간이 초과되어 결과가 미확정입니다.':'조회 요청 시간이 초과되었습니다.'))},this.timeoutMs)})])
   this.unchanged(start,write)
   if(response.error){
    const e=response.error as {code?:unknown;message?:unknown}
    if(e.code==='P0001'&&e.message==='revision_conflict')return fail('conflict','conflict','서버 수정 버전이 변경되었습니다. 다시 조회하세요.')
    if(e.code==='42501'||response.status===403)return fail('ownership','permission-denied','서버에서 접근을 거부했습니다.')
    if(response.status===401)return fail('unauthenticated','authentication','서버 인증이 만료되었거나 거부되었습니다.')
    if(e.code==='22023')return fail('invalid-data','invalid-input','서버가 백업 형식 또는 수정 버전을 거부했습니다.')
    return fail(write?'unconfirmed':'invalid-data','network',write?'저장 결과를 확인하지 못했습니다. 자동 재시도하지 않습니다.':'서버 조회에 실패했습니다.')
   }
   if(response.status<200||response.status>=300)return fail(write?'unconfirmed':'invalid-data','invalid-response','서버 응답을 확인하지 못했습니다.')
   return response.data
  }catch(e){if(e instanceof SupabaseTransportError)throw e;return fail(write?'unconfirmed':'invalid-data','network',write?'저장 결과를 확인하지 못했습니다. 자동 재시도하지 않습니다.':'서버 조회에 실패했습니다.')}
  finally{if(timer!==undefined)clearTimeout(timer)}
 }
 private row(raw:unknown,owner:string,write:boolean):CloudRecord {
  const parsed=rowSchema.safeParse(raw)
  if(!parsed.success||!backupSchema.safeParse(parsed.data.backup).success)return fail(write?'unconfirmed':'invalid-data','invalid-response','서버 기록 형식이 올바르지 않습니다.')
  const r=parsed.data
  if(r.owner_id!==owner)return fail(write?'unconfirmed':'ownership','invalid-response','서버 기록 소유자가 요청과 다릅니다.')
  return {ownerId:r.owner_id,formatVersion:r.format_version,revision:r.revision,updatedAt:r.updated_at,backup:structuredClone(r.backup) as Data}
 }
 async readOwn(expectedOwnerId:string):Promise<CloudRecord|null>{
  const start=this.binding(expectedOwnerId)
  const raw=await this.request(start,false,signal=>this.client.from('nurse_backups').select('owner_id,format_version,revision,backup,updated_at').eq('owner_id',expectedOwnerId).abortSignal(signal).retry(false).maybeSingle())
  return raw===null?null:this.row(raw,expectedOwnerId,false)
 }
 async compareAndSwap(input:Parameters<CloudTransport['compareAndSwap']>[0]):Promise<CloudRecord>{
  const {expectedOwnerId,expectedRevision,formatVersion}=input
  const start=this.binding(expectedOwnerId)
  let backup:Data
  try{backup=structuredClone(input.backup)}catch{return fail('invalid-data','invalid-input','전체 백업 형식이 올바르지 않습니다.')}
  if(formatVersion!=='1.0'||!backupSchema.safeParse(backup).success||(expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER)))return fail('invalid-data','invalid-input','백업 형식 또는 수정 버전이 올바르지 않습니다.')
  const raw=await this.request(start,true,signal=>this.client.rpc('save_nurse_backup',{p_expected_owner_id:expectedOwnerId,p_expected_revision:expectedRevision,p_format_version:formatVersion,p_backup:backup}).retry(false).abortSignal(signal))
  // PostgREST composite responses can be an object or one row; no multi-row acceptance.
  const row=this.row(Array.isArray(raw)&&raw.length===1?raw[0]:raw,expectedOwnerId,true)
  if(row.revision!==(expectedRevision??0)+1||canonical(row.backup)!==canonical(backup))return fail('unconfirmed','invalid-response','저장 응답이 요청과 달라 결과가 미확정입니다.')
  return row
 }
}
