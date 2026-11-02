import {test,expect} from '@playwright/test'
for(const viewport of [{width:1280,height:800},{width:390,height:844}])test(`UI v1 주요 기능 안내와 이동 ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await page.goto('./');
 await expect(page.getByRole('heading',{name:'이 앱에서 할 수 있는 일'})).toBeVisible();
 await page.getByRole('button',{name:'JSON 가져오기'}).click();
 await expect(page.getByRole('heading',{name:'보고서 가져오기'})).toBeVisible();
 await page.getByRole('button',{name:'대시보드',exact:true}).click();
 await page.getByRole('button',{name:'사람 목록 보기'}).click();
 await expect(page.getByRole('heading',{name:'사람',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'대시보드',exact:true}).click();
 await page.getByRole('button',{name:'백업 설정 열기'}).click();
 await expect(page.getByRole('heading',{name:'백업 및 복원'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'위험한 작업'})).toBeVisible();
 await expect(page.getByRole('button',{name:'모든 데이터 삭제'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
