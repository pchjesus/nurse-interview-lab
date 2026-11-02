import {z} from 'zod'
import {backupSchema,type Data} from '../model'

/** The adapter must bind expectedOwnerId to the actual authenticated token and use a server-side atomic CAS. The server must enforce RLS. */
export interface CloudTransport {
 session():Promise<{userId:string}|null>
 readOwn(expectedOwnerId:string):Promise<unknown|null>
 compareAndSwap(input:{expectedOwnerId:string,expectedRevision:number|null,formatVersion:'1.0',backup:Data}):Promise<unknown>
}
export class CloudError extends Error {
 constructor(public readonly code:'unauthenticated'|'invalid-data'|'conflict'|'unconfirmed'|'approval-required'|'changed'|'ownership',message:string){super(message);this.name='CloudError'}
}
const recordSchema=z.object({ownerId:z.string().min(1),formatVersion:z.literal('1.0'),revision:z.number().int().positive().safe(),updatedAt:z.string().datetime({offset:true}),backup:z.unknown()})
export interface CloudRecord {ownerId:string;formatVersion:'1.0';revision:number;updatedAt:string;backup:Data}
export interface MigrationPreview {readonly people:number;readonly reports:number;readonly serverHasData:boolean}

function canonical(value:unknown,seen=new WeakSet<object>()):unknown {
 if(value===null||typeof value==='string'||typeof value==='boolean')return value
 if(typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0))return value
 if(typeof value!=='object'||seen.has(value))throw Error('not JSON')
 const proto=Object.getPrototypeOf(value);if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null)throw Error('not JSON')
 seen.add(value)
 try{if(Array.isArray(value))return Array.from(value,v=>canonical(v,seen));return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key],seen)]))}finally{seen.delete(value)}
}
function snapshot(value:unknown):{data:Data,serialized:string}{
 try{const safe=canonical(value);const encoded=JSON.stringify(safe);if(typeof encoded!=='string')throw Error('empty');const parsed:unknown=JSON.parse(JSON.stringify(value));if(!backupSchema.safeParse(parsed).success)throw Error('invalid');return {data:parsed as Data,serialized:encoded}}catch{throw new CloudError('invalid-data','지원하지 않거나 손상된 전체 백업입니다.')}
}
function record(value:unknown,ownerId:string):CloudRecord {
 const result=recordSchema.safeParse(value);if(!result.success)throw new CloudError('invalid-data','서버 기록 형식이 올바르지 않습니다.')
 if(result.data.ownerId!==ownerId)throw new CloudError('ownership','로그인 사용자와 서버 기록 소유자가 일치하지 않습니다.')
 const backup=snapshot(result.data.backup).data
 return {...result.data,backup}
}
/** Nothing in this module creates a network client or authenticates a user. */
export class CloudRepository {
 private previews=new WeakMap<MigrationPreview,{ownerId:string,serialized:string}>()
 constructor(private readonly transport:CloudTransport){}
 private async user():Promise<string>{const session=await this.transport.session();if(!session?.userId)throw new CloudError('unauthenticated','로그인이 필요합니다.');return session.userId}
 private async sameUser(owner:string){if(await this.user()!==owner)throw new CloudError('ownership','작업 중 로그인 계정이 변경되었습니다.')}
 async read():Promise<CloudRecord|null>{return this.readForOwner(await this.user())}
 private async readForOwner(owner:string):Promise<CloudRecord|null>{await this.sameUser(owner);const raw=await this.transport.readOwn(owner);await this.sameUser(owner);return raw===null?null:record(raw,owner)}
 async save(data:Data,expectedRevision:number|null):Promise<CloudRecord>{
  return this.saveForOwner(data,expectedRevision,await this.user())
 }
 private async saveForOwner(data:Data,expectedRevision:number|null,owner:string):Promise<CloudRecord>{
  if(expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1))throw new CloudError('invalid-data','서버 수정 버전이 올바르지 않습니다.')
  const copy=snapshot(data),expectedNext=(expectedRevision??0)+1
  let rawAck:unknown
  await this.sameUser(owner)
  try{rawAck=await this.transport.compareAndSwap({expectedOwnerId:owner,expectedRevision,formatVersion:'1.0',backup:copy.data})}catch(e){if(e instanceof CloudError)throw e;throw new CloudError('unconfirmed','서버 저장 결과를 확인하지 못했습니다. 다시 전송하기 전에 서버 상태를 확인하세요.')}
  let ack:CloudRecord
  try{ack=record(rawAck,owner)}catch{throw new CloudError('unconfirmed','서버 저장 응답을 확인하지 못했습니다. 다시 전송하기 전에 서버 상태를 확인하세요.')}
  try{await this.sameUser(owner)}catch{throw new CloudError('unconfirmed','저장 중 계정이 변경되어 결과를 확인하지 못했습니다. 다시 전송하기 전에 서버 상태를 확인하세요.')}
  if(ack.revision!==expectedNext||snapshot(ack.backup).serialized!==copy.serialized)throw new CloudError('unconfirmed','서버 응답이 요청과 일치하지 않습니다. 저장 여부를 확인하세요.')
  let verified:CloudRecord|null
  try{verified=await this.readForOwner(owner)}catch(e){throw new CloudError('unconfirmed','저장 후 서버 상태를 확인하지 못했습니다. 자동 재시도하지 않습니다.')}
  if(!verified||verified.ownerId!==owner||verified.revision!==ack.revision||snapshot(verified.backup).serialized!==copy.serialized)throw new CloudError('unconfirmed','서버의 최종 상태가 요청과 일치하지 않습니다. 충돌 여부를 확인하세요.')
  return verified
 }
 async previewMigration(local:Data):Promise<MigrationPreview>{
  const ownerId=await this.user(),copy=snapshot(local),existing=await this.readForOwner(ownerId);await this.sameUser(ownerId)
  const preview=Object.freeze({people:copy.data.people.length,reports:copy.data.reports.length,serverHasData:existing!==null})
  this.previews.set(preview,{ownerId,serialized:copy.serialized});return preview
 }
 async migrate(preview:MigrationPreview,currentLocal:Data,approved:boolean):Promise<CloudRecord>{
  const candidate=this.previews.get(preview);if(!candidate)throw new CloudError('approval-required','이전 미리보기를 다시 확인하세요.')
  if(!approved)throw new CloudError('approval-required','이전하려면 명시적인 승인이 필요합니다.')
  if(preview.serverHasData)throw new CloudError('conflict','서버에 기존 데이터가 있어 자동 이전할 수 없습니다.')
  const copy=snapshot(currentLocal);if(copy.serialized!==candidate.serialized)throw new CloudError('changed','미리보기 후 로컬 데이터가 변경되었습니다. 다시 확인하세요.')
  await this.sameUser(candidate.ownerId);this.previews.delete(preview)
  return this.saveForOwner(copy.data,null,candidate.ownerId)
 }
}
