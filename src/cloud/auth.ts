import type {SupabaseClient, Session} from '@supabase/supabase-js'
import {createEmailOtpClient} from './supabase'

type AuthHandle={client:SupabaseClient;abort:()=>void}
type Factory=()=>Promise<{status:'initialized';client:SupabaseClient;abort:()=>void}|{status:'unconfigured'|'invalid';reason:string}>
export type AuthState={phase:'signed-out'|'requesting'|'code'|'verifying'|'signed-in'|'signing-out'|'error';email:string;message:string;expiresAt:number|null}
const initial=():AuthState=>({phase:'signed-out',email:'',message:'',expiresAt:null})
/** Owns a single in-memory session. No tokens are exposed in UI state. */
export class EmailOtpAuth {
 private handle:AuthHandle|null=null
 private epoch=0
 private timer:ReturnType<typeof setTimeout>|null=null
 private expectedEmail=''
 private userId=''
 private subscription:{unsubscribe:()=>void}|null=null
 #lifecycle?:{verified:(session:Session)=>void;invalidate:()=>void}
 private state:AuthState=initial()
 constructor(private readonly publish:(state:AuthState)=>void,private readonly factory:Factory=createEmailOtpClient,private readonly now:()=>number=Date.now,lifecycle?:{verified:(session:Session)=>void;invalidate:()=>void}){this.#lifecycle=lifecycle}
 private emit(patch:Partial<AuthState>){this.state={...this.state,...patch};this.publish({...this.state})}
 private dispose(){this.#lifecycle?.invalidate();this.epoch++;this.subscription?.unsubscribe();this.subscription=null;this.handle?.abort();this.handle=null;this.expectedEmail='';this.userId='';if(this.timer)clearTimeout(this.timer);this.timer=null}
 cancel(){this.dispose();this.state=initial();this.publish({...this.state})}
 destroy(){this.dispose()}
 async request(email:string){
  const clean=email.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)||clean.length>254){this.emit({message:'올바른 이메일을 입력하세요.'});return}
  if(['requesting','verifying','signing-out','signed-in'].includes(this.state.phase))return
  this.dispose();const op=this.epoch;this.emit({phase:'requesting',email:clean,message:'인증 코드를 요청하고 있습니다.'})
  try{const result=await this.factory();if(op!==this.epoch){if(result.status==='initialized')result.abort();return}if(result.status!=='initialized'){this.emit({phase:'error',message:'인증 연결 오류: 서버 공개 설정을 확인하세요.'});return}this.handle=result;const initialized=await result.client.auth.initialize();if(op!==this.epoch)return;if(initialized.error)throw new Error('auth initialization failed');this.subscription=result.client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'&&this.state.phase==='verifying'){this.dispose();this.emit({phase:'signed-out',email:'',expiresAt:null,message:'인증이 종료됐습니다. 다시 로그인하세요.'});return}if(this.state.phase!=='signed-in')return;if(event==='SIGNED_OUT'||event==='SIGNED_IN'||(session?.user?.id&&session.user.id!==this.userId)){this.dispose();this.emit({phase:'signed-out',email:'',expiresAt:null,message:event==='SIGNED_OUT'?'인증이 종료됐습니다. 다시 로그인하세요.':'인증 계정이 변경되어 다시 로그인해야 합니다.'})}}).data.subscription;const response=await result.client.auth.signInWithOtp({email:clean,options:{shouldCreateUser:false}});if(op!==this.epoch)return;if(response.error){this.emit({phase:'error',message:response.error.status===429?'요청이 너무 많습니다. 잠시 후 다시 시도하세요.':!response.error.status||response.error.status>=500?'인증 연결 오류: 잠시 후 다시 시도하세요.':'인증 코드 요청에 실패했습니다. 이메일과 연결 상태를 확인하세요.'});return}this.expectedEmail=clean;this.emit({phase:'code',message:'이메일로 받은 6자리 코드를 입력하세요. 기존 계정만 로그인할 수 있습니다.'})}catch{if(op===this.epoch)this.emit({phase:'error',message:'인증 연결 오류: 잠시 후 다시 시도하세요.'})}
 }
 async verify(code:string){
  if(this.state.phase!=='code'||!this.handle)return
  this.#lifecycle?.invalidate();if(!/^\d{6}$/.test(code)){this.emit({message:'6자리 숫자 코드를 입력하세요.'});return}
  const op=this.epoch,handle=this.handle,email=this.expectedEmail;this.emit({phase:'verifying',message:'코드를 확인하고 있습니다.'})
  try{const {data,error}=await handle.client.auth.verifyOtp({email,token:code,type:'email'});if(op!==this.epoch)return
   const session=data?.session,user=data?.user,expiresAt=session?.expires_at
   if(error?.status===429){this.emit({phase:'code',message:'시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.'});return}
   if(error&&(!error.status||error.status>=500)){this.emit({phase:'error',message:'인증 연결 오류: 코드를 다시 요청하세요.'});return}
   if(error||!session?.access_token||!user?.id||session.user?.id!==user.id||!user.email||user.email.toLowerCase()!==email.toLowerCase()||!Number.isFinite(expiresAt)||!expiresAt||expiresAt*1000<=this.now()){
    if(session?.access_token){this.dispose();this.emit({phase:'error',email:'',message:'인증 정보를 확인하지 못했습니다. 다시 로그인하세요.',expiresAt:null})}else this.emit({phase:'code',message:'코드가 올바르지 않거나 만료됐습니다. 확인하거나 다시 요청하세요.'});return
   }
   this.#lifecycle?.verified(session);this.userId=user.id;this.emit({phase:'signed-in',email:user.email,message:'서버 저장은 연결되지 않았습니다.',expiresAt:expiresAt*1000});this.scheduleExpiry()
  }catch{if(op===this.epoch)this.emit({phase:'error',message:'인증 연결 오류: 코드를 다시 요청하세요.'})}
 }
 private scheduleExpiry(){if(this.timer)clearTimeout(this.timer);const remaining=(this.state.expiresAt??0)-this.now();if(remaining<=0){this.expireIfNeeded();return}this.timer=setTimeout(()=>{this.timer=null;this.scheduleExpiry()},Math.min(remaining,2147483647))}
 expireIfNeeded(){if(this.state.phase==='signed-in'&&this.state.expiresAt!==null&&this.state.expiresAt<=this.now()){this.dispose();this.emit({phase:'signed-out',email:'',message:'인증 세션이 만료됐습니다. 다시 로그인하세요.',expiresAt:null})}}
 async logout(){if(this.state.phase!=='signed-in'||!this.handle||!this.userId)return;const handle=this.handle;this.#lifecycle?.invalidate();this.emit({phase:'signing-out',message:'로그아웃하고 있습니다.'});const op=this.epoch;let failed=false;try{const result=await handle.client.auth.signOut({scope:'local'});failed=!!result.error}catch{failed=true}if(op!==this.epoch)return;this.dispose();this.emit({phase:'signed-out',email:'',expiresAt:null,message:failed?'이 기기의 인증은 종료됐지만 서버 로그아웃을 확인하지 못했습니다.':'로그아웃했습니다. 기기 기록은 유지됩니다.'})}
}
