import {EmailOtpAuth, type AuthState} from './auth'
import {createIsolatedSessionBroker} from './sessionBroker'
import type {CloudTransport} from './repository'
/** Inactive composition. Only command closures are exposed, never broker or SDK internals. */
export function createInactiveOtpTransport(settings:{VITE_SUPABASE_URL:string;VITE_SUPABASE_PUBLISHABLE_KEY:string},fetch:typeof globalThis.fetch,publish:(state:AuthState)=>void){
 const broker=createIsolatedSessionBroker(settings,fetch)
 const auth=new EmailOtpAuth(publish,undefined,undefined,{verified:session=>{if(session.expires_at===undefined)throw new Error('인증 세션 만료 정보가 없습니다.');broker.approve({...session,expires_at:session.expires_at})},invalidate:()=>broker.logout()})
 const commands=Object.freeze({request:(email:string)=>auth.request(email),verify:(code:string)=>auth.verify(code),logout:()=>auth.logout(),cancel:()=>auth.cancel(),destroy:()=>auth.destroy(),expireIfNeeded:()=>auth.expireIfNeeded()})
 const transport:CloudTransport=Object.freeze({session:()=>broker.transport.session(),readOwn:(id:string)=>broker.transport.readOwn(id),compareAndSwap:(input:Parameters<CloudTransport['compareAndSwap']>[0])=>broker.transport.compareAndSwap(input)})
 return Object.freeze({auth:commands,transport})
}
