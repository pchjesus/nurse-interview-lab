import {describe,it,expect} from 'vitest'
import sample from './data/sample.json'
import {reportSchema,reportWarnings,migrateEdits,empty,backupSchema} from './model'
import {effectiveTranscript,evaluationGroups} from './feedback'

describe('실사용 준비',()=>{
 it('가상 1.1 파일은 세 응시자, 혼합 질문과 미검증 자료를 포함한다',()=>{const r=reportSchema.parse(sample);expect(r.participants.filter(p=>p.role==='응시자')).toHaveLength(3);expect(r.questions.map(q=>q.type)).toEqual(['직무','인성']);expect(r.sources[0].verified).toBe(false);expect(r.transcript.some(t=>t.unclear)).toBe(true)})
 it('레거시 연결 오류를 보존하고 필드별로 경고한다',()=>{const r=reportSchema.parse({...sample,schemaVersion:'1.0',evaluations:[{participantId:'a',questionId:'없는질문',strengths:{references:[{sourceId:'없는출처'}],utteranceIds:['없는발화']}}]});expect(reportWarnings(r).join()).toContain('없는질문');expect(reportWarnings(r).join()).toContain('없는출처');expect(reportWarnings(r).join()).toContain('없는발화')})
 it('충돌한 과거 수정 두 개를 보존하고 중복 ID를 임의 적용하지 않는다',()=>{const report=reportSchema.parse({...sample,schemaVersion:'1.0',transcript:[sample.transcript[1],sample.transcript[1]]});const entry={report,links:{},displayTitle:null,modifiedAt:'2026-11-02T00:00:00.000Z',transcriptEdits:{'0':{text:'옛 수정'}},transcriptEditsById:{u1:{text:'다른 수정'}}};const migrated=migrateEdits(entry);expect(migrated.transcriptEdits?.['0'].text).toBe('옛 수정');expect(effectiveTranscript(migrated)[1].text).toBe(sample.transcript[1].text);expect(backupSchema.parse({...empty(),reports:[migrated]}).reports[0].transcriptEditsById?.u1.text).toBe('다른 수정')})
 it('구조화된 평가의 내용과 근거를 자연스러운 한국어로 유지한다',()=>{const report=reportSchema.parse(sample);const entry={report,links:{},displayTitle:null,modifiedAt:'2026-11-02T00:00:00.000Z'};const text=evaluationGroups(report.evaluations[0],entry).flatMap(x=>x.lines).join(' ');expect(text).toContain('가상 연습용 해석');expect(text).toContain('실제 임상 근거가 아닙니다');expect(text).not.toContain('항목 1 ·')})
})
