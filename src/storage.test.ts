import {expect,it} from 'vitest'
import {empty,type Data} from './model'
import {saveLatest} from './storage'
it('기기 저장을 켜는 동안 변경된 데이터까지 저장한 뒤 완료한다',async()=>{let data:Data=empty();let release!:()=>void;const gate=new Promise<void>(r=>release=r);const writes:Data[]=[];const operation=saveLatest(()=>data,async value=>{writes.push(value);if(writes.length===1)await gate});data={...data,people:[{personId:'p',name:'가상',alias:''}]};release();await operation;expect(writes).toHaveLength(2);expect(writes[1]).toEqual(data)})
it('저장 실패는 완료로 처리하지 않고 호출자에게 전달한다',async()=>{await expect(saveLatest(empty,async()=>{throw Error('저장 실패')})).rejects.toThrow('저장 실패')})
