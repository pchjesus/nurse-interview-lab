import { describe, expect, it } from 'vitest'
import { backupSchema, empty, parseJSON, reportSchema, selectReports, title, type Data } from './model'
const report=(reportId:string,date:string, name='가')=>reportSchema.parse({schemaVersion:'1.0',reportId,session:{date,type:'직무',hospital:'가상병원',title:name},participants:[{participantId:'a',name:'동명'},{participantId:'b',name:'동명'}],questions:[],transcript:[],evaluations:[],sources:[]})
const entry=(id:string,date:string,name:string,modifiedAt:string)=>({report:report(id,date,name),links:{a:'one',b:'two'},displayTitle:null,modifiedAt})
const data:Data={...empty(),people:[{personId:'one',name:'동명',alias:''},{personId:'two',name:'동명',alias:''}],reports:[entry('a','2026-01-01','나','2026-01-03T00:00:00.000Z'),entry('b','2026-02-01','가','2026-01-02T00:00:00.000Z')]}
const filter={search:'',person:'',type:'',hospital:'',from:'',to:'',sort:'new'}
describe('보고서와 백업 계약',()=>{
 it('동명이인과 복수 참여자 연결을 백업에서 보존한다',()=>expect(backupSchema.parse(JSON.parse(JSON.stringify(data)))).toEqual(data))
 it('중복 ID와 잘못된 연결을 거부한다',()=>{expect(backupSchema.safeParse({...data,reports:[...data.reports,data.reports[0]]}).success).toBe(false);expect(backupSchema.safeParse({...data,people:[]}).success).toBe(false)})
 it('잘못된 날짜와 외부 참가자, 손상 JSON을 거부한다',()=>{expect(reportSchema.safeParse({...data.reports[0].report,session:{date:'2026-02-30',type:'직무',hospital:''}}).success).toBe(false);expect(reportSchema.safeParse({...data.reports[0].report,transcript:[{participantId:'x',text:'a'}]}).success).toBe(false);expect(()=>parseJSON('{')).toThrow()})
 it('제목 변경과 복원은 원본과 연결을 보존한다',()=>{const e=data.reports[0], changed={...e,displayTitle:'새 제목'};expect(title(changed)).toBe('새 제목');expect(title({...changed,displayTitle:null})).toBe('나');expect(changed.links).toEqual(e.links);expect(changed.report).toEqual(e.report)})
 it('날짜, 제목, 수정 시각 정렬과 복합 필터를 적용한다',()=>{expect(selectReports(data,filter).map(e=>e.report.reportId)).toEqual(['b','a']);expect(selectReports(data,{...filter,sort:'old'}).map(e=>e.report.reportId)).toEqual(['a','b']);expect(selectReports(data,{...filter,sort:'title'}).map(e=>e.report.reportId)).toEqual(['b','a']);expect(selectReports(data,{...filter,sort:'modified'}).map(e=>e.report.reportId)).toEqual(['a','b']);expect(selectReports(data,{...filter,person:'two',type:'직무',hospital:'가상',from:'2026-02-01',search:'가'})).toHaveLength(1)})
})
