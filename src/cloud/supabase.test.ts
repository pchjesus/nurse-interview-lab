import {afterEach,describe,expect,it,vi} from 'vitest'
import {createInactiveSupabaseClient,validateSupabaseSettings} from './supabase'
const url='https://aevhsdqrirgslfetknip.supabase.co'
const publicKey='sb_publishable_012345678901234567890123456789'
const valid={VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:publicKey}
afterEach(()=>vi.restoreAllMocks())
describe('비활성 Supabase 설정',()=>{
 it('설정이 없거나 일부가 없어도 안전하게 반환한다',async()=>{expect(validateSupabaseSettings({}).status).toBe('unconfigured');expect((await createInactiveSupabaseClient({VITE_SUPABASE_URL:url})).status).toBe('unconfigured')})
 it('HTTPS 전용 프로젝트 URL만 허용한다',()=>{for(const bad of ['http://aevhsdqrirgslfetknip.supabase.co','https://other.supabase.co','https://aevhsdqrirgslfetknip.supabase.co/path','https://aevhsdqrirgslfetknip.supabase.co?x=1','https://user:pass@aevhsdqrirgslfetknip.supabase.co','not-a-url'])expect(validateSupabaseSettings({...valid,VITE_SUPABASE_URL:bad}).status).toBe('invalid');expect(validateSupabaseSettings({...valid,VITE_SUPABASE_URL:url+'/'}).status).toBe('ready')})
 it('비밀키와 service_role 및 잘못된 키를 거부하며 값은 오류에 노출하지 않는다',()=>{for(const key of ['sb_secret_example','service_role_very_sensitive_fake','eyJhbGci.fake.jwt','sb_publishable_short']){const result=validateSupabaseSettings({...valid,VITE_SUPABASE_PUBLISHABLE_KEY:key});expect(result.status).toBe('invalid');expect(JSON.stringify(result)).not.toContain(key)}})
 it('명시적 생성에도 자동 인증이나 외부 요청이 일어나지 않는다',async()=>{const fetchSpy=vi.spyOn(globalThis,'fetch');const result=await createInactiveSupabaseClient(valid);expect(result.status).toBe('initialized');await new Promise(resolve=>setTimeout(resolve,20));expect(fetchSpy).not.toHaveBeenCalled()})
 it('명시적 SDK 호출도 차단된 fetch를 통해 외부로 나가지 않는다',async()=>{const fetchSpy=vi.spyOn(globalThis,'fetch');const result=await createInactiveSupabaseClient(valid);if(result.status!=='initialized')throw Error('초기화 실패');await result.client.auth.initialize();const response=await result.client.functions.invoke('fictional');expect(response.error).toBeTruthy();expect(fetchSpy).not.toHaveBeenCalled()})
})
