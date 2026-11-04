import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'

const original='면접관 00:01\n  질문: 환자를 어떻게 확인하나요?  \n응시자 00:03\n가상 답변 & <script>window.testXSS=1</script> 😀'
const report={schemaVersion:'1.0',reportId:'fictional-clova-test',session:{date:'2026-11-02',type:'직무',hospital:'가상병원',title:'가상 면접'},participants:[{participantId:'a',name:'가상 응시자'}],questions:[],transcript:[],evaluations:[],sources:[]}
for(const width of [1280,390])test(`전사 원문과 복사·삭제 ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844})
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{if((window as unknown as {failCopy:boolean}).failCopy)throw Error('denied');(window as unknown as {copied:string}).copied=text}}})})
 const external:string[]=[];page.on('request',request=>{if(new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url())})
 await page.goto('./');await page.getByRole('button',{name:'면접 기록',exact:true}).click()
 const input=page.getByLabel('CLOVA 전사본 텍스트');await expect(page.getByText('전사본을 입력해 주세요.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'원문 복사'})).toBeDisabled()
 await input.fill('  \n  ');await expect(page.getByRole('button',{name:'원문 복사'})).toBeDisabled()
 await input.fill(original);await expect(input).toHaveValue(original);expect(await page.getByLabel('전사본 원문 미리보기').textContent()).toBe(original);expect(await page.evaluate(()=>(window as unknown as {testXSS?:number}).testXSS)).toBeUndefined()
 await expect(page.locator('#clova-count')).toContainText(`${Array.from(original).length}자`)
 await page.getByRole('button',{name:'원문 복사'}).click();expect(await page.evaluate(()=>(window as unknown as {copied:string}).copied)).toBe(original)
 await page.evaluate(()=>{(window as unknown as {failCopy:boolean}).failCopy=true});await page.getByRole('button',{name:'원문 복사'}).click();await expect(page.getByRole('alert')).toContainText('직접 선택해 복사');await expect(input).toBeFocused();expect(await input.evaluate(el=>{const t=el as HTMLTextAreaElement;return t.selectionEnd-t.selectionStart})).toBe(original.length)
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'전사본 지우기'}).click();await expect(input).toHaveValue(original)
 await page.getByRole('button',{name:'대시보드',exact:true}).click();await page.getByRole('button',{name:'면접 기록',exact:true}).click();await expect(input).toHaveValue(original)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'전사본 지우기'}).click();await expect(input).toHaveValue('');expect(external).toEqual([])
})

test('5MiB 초과 입력은 기존 초안을 보존한다',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'면접 기록',exact:true}).click();const input=page.getByLabel('CLOVA 전사본 텍스트');await input.fill('가상 초안')
 await input.fill('가'.repeat(Math.floor(5*1024*1024/3)+1));await expect(page.getByRole('alert')).toContainText('5MiB');await expect(input).toHaveValue('가상 초안')
 await input.fill('a'.repeat(5*1024*1024+1));await expect(page.getByRole('alert')).toContainText('5MiB');await expect(input).toHaveValue('가상 초안')
})

test('연습 초안은 분리되고 기기 저장·백업에 포함되지 않는다',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'면접 기록',exact:true}).click();await page.getByLabel('JSON 붙여넣기').fill(JSON.stringify(report));await page.getByRole('button',{name:'검증 및 미리보기'}).click();await page.getByRole('button',{name:'가져오기 완료'}).click()
 await page.getByRole('button',{name:'설정',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'기기 저장 켜기'}).click();await expect(page.getByText('기기 저장 완료').first()).toBeVisible()
 async function backup(){const event=page.waitForEvent('download');await page.getByRole('button',{name:'전체 백업 내보내기'}).click();return JSON.parse(await readFile(await (await event).path(),'utf8'))}
 const before=await backup();await page.getByRole('button',{name:'면접 기록',exact:true}).click();const input=page.getByLabel('CLOVA 전사본 텍스트');await input.fill('실제 사용을 흉내 낸 가상 초안');await expect(page.getByText('기기 저장을 켜도 저장되거나 전체 백업에 포함되지 않습니다.',{exact:false})).toBeVisible()
 await page.getByRole('button',{name:'설정',exact:true}).click();expect(await backup()).toEqual(before)
 await page.getByRole('button',{name:'대시보드',exact:true}).click();await page.getByRole('button',{name:'가상 데이터로 연습'}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'면접 기록',exact:true}).click();await expect(input).toHaveValue('');await input.fill('연습 전용 가상 초안');await page.getByRole('button',{name:'연습 종료'}).click();await page.getByRole('button',{name:'면접 기록',exact:true}).click();await expect(input).toHaveValue('실제 사용을 흉내 낸 가상 초안')
 await page.getByRole('button',{name:'대시보드',exact:true}).click();await page.getByRole('button',{name:'가상 데이터로 연습'}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'면접 기록',exact:true}).click();await expect(input).toHaveValue('');await page.getByRole('button',{name:'연습 종료'}).click()
 await page.reload();await page.getByRole('button',{name:'면접 기록',exact:true}).click();await expect(input).toHaveValue('');await expect(page.getByRole('button',{name:'가상 면접'})).toBeVisible();await expect(page.getByText('새로고침하거나 창을 닫으면 사라집니다.',{exact:false})).toBeVisible()
})
