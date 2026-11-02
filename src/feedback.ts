import {type Entry,migrateEdits} from './model'
export const labels = {answer:'실제 답변',strengths:'잘한 점',evidence:'근거 설명',weaknesses:'부족한 점',improvements:'개선 방향',improvedAnswer:'개선 답변 (원문에 없는 제안)',overall:'종합 평가',intent:'질문 의도 충족',logic:'답변의 논리성',specificity:'경험의 구체성',sincerity:'진정성과 설득력',professionalism:'전문직 태도',communication:'의사소통과 협력',hospitalValues:'병원 가치와의 연결'} as const
export function textValue(v:unknown):string {if(typeof v==='string'||typeof v==='number')return String(v);if(Array.isArray(v))return v.map(textValue).filter(Boolean).join('\n');return ''}
export function effectiveTranscript(entry:Entry) {const migrated=migrateEdits(entry);return migrated.report.transcript.map((u,i)=>({...u,...(migrated.transcriptEdits?.[String(i)]||{}),...(typeof u.utteranceId==='string'&&entry.report.transcript.filter(t=>t.utteranceId===u.utteranceId).length===1?migrated.transcriptEditsById?.[u.utteranceId]||{}:{}), originalText:u.text, index:i}))}
export function participantFeedback(entry:Entry, participantId:string) {const r=entry.report, transcript=effectiveTranscript(entry);const questions=[...r.questions].sort((a,b)=>(typeof a.order==='number'?a.order:r.questions.indexOf(a))-(typeof b.order==='number'?b.order:r.questions.indexOf(b)));return questions.map(q=>({question:q, utterances:transcript.filter(t=>t.participantId===participantId&&t.questionId===q.questionId), evaluations:r.evaluations.filter(e=>e.participantId===participantId&&e.questionId===q.questionId)}))}
export function sourceDescription(s:Record<string,unknown>) {const fields:[string,string][]=[['저자','author'],['연도','year'],['자료명','title'],['판차','edition'],['출판사','publisher'],['APA 7','apa']];return fields.flatMap(([label,key])=>{const v=s[key];return typeof v==='string'||typeof v==='number'?`${label}: ${v}`:[]}).join(' · ')||'자료명 없음'}
const fieldNames:Record<string,string>={content:'평가 내용',quote:'연결된 발언',utteranceIds:'발화 ID',reason:'판단 이유',nursingEvidence:'간호학적 근거',importance:'중요성',improvement:'개선 방법',sourceId:'출처 ID',pages:'페이지',verified:'입력상 확인 상태',references:'참고문헌'}
export function feedbackLines(value:unknown,entry:Entry):string[] {
 const lines:string[]=[]
 function walk(v:unknown,label:string){
  if(v===null||v===undefined){lines.push(`${label}: 값 없음`);return}
  if(typeof v==='string'||typeof v==='number'){lines.push(label?`${label}: ${String(v)}`:String(v));return}
  if(typeof v==='boolean'){lines.push(`${label}: ${v?'분석자 입력상 확인됨 (앱 미검증)':'미검증'}`);return}
  if(Array.isArray(v)){if(!v.length){lines.push(`${label||'항목'}: 없음`);return}v.forEach((x,i)=>walk(x,typeof x==='object'&&x!==null?`항목 ${i+1}`:label));return}
  if(typeof v==='object'){
   const obj=v as Record<string,unknown>;const keys=Object.keys(obj)
   if(!keys.length){lines.push(`${label||'항목'}: 빈 항목`);return}
   if(typeof obj.sourceId==='string'&&!('pages' in obj))lines.push('페이지 정보 없음')
   for(const key of keys){const child=obj[key];if(key==='pages'&&typeof child==='string')lines.push(`페이지: ${child} · ${obj.verified===true?'분석자 입력상 확인됨 (앱 미검증)':'페이지 미검증'}`)
    else if(key==='sourceId'&&typeof child==='string'){const source=entry.report.sources.find(s=>s.sourceId===child);lines.push(`출처 ${child}: ${source?sourceDescription(source):'참고문헌 없음 (잘못된 출처 ID)'} · ${source?.verified===true?'분석자 입력상 확인됨 (앱 미검증)':'미검증'}`)}
    else walk(child,fieldNames[key]||`지원되지 않는 필드 ${key}`)
   }return
  }
  lines.push(`${label||'항목'}: 지원되지 않는 값`)
 }
 if(value!==undefined)walk(value,'');return lines
}
export function evaluationLines(e:Record<string,unknown>,entry:Entry){const keys=[...Object.keys(labels),'sourceIds','verificationStatus',...Object.keys(e).filter(k=>k!=='participantId'&&k!=='questionId'&&!(k in labels)&&k!=='sourceIds'&&k!=='verificationStatus')];return keys.filter(key=>key in e).map(key=>[key,e[key]] as const).flatMap(([key,value])=>{const label=(labels as Record<string,string>)[key]||({sourceIds:'참고문헌',verificationStatus:'근거 검증 상태'} as Record<string,string>)[key]||`지원되지 않는 평가 필드 ${key}`;const data=key==='sourceIds'&&Array.isArray(value)?value.map(sourceId=>({sourceId})):value;return feedbackLines(data,entry).map(line=>({label,text:line}))}) }
function collectRefs(value:unknown,ids:Set<string>){if(Array.isArray(value))value.forEach(v=>collectRefs(v,ids));else if(value&&typeof value==='object'){for(const [key,v] of Object.entries(value)){if(key==='sourceId'&&typeof v==='string')ids.add(v);else if(key==='sourceIds'&&Array.isArray(v))v.forEach(x=>{if(typeof x==='string')ids.add(x)});else collectRefs(v,ids)}}}
export function sourcesFor(entry:Entry, participantId:string) {const ids=new Set<string>();entry.report.evaluations.filter(e=>e.participantId===participantId).forEach(e=>collectRefs(e,ids));return entry.report.sources.filter(s=>typeof s.sourceId==='string'&&ids.has(s.sourceId))}
export function safeFileName(s:string) {return s.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,160)||'보고서'}

export function evaluationGroups(e:Record<string,unknown>,entry:Entry) {const groups:{label:string,lines:string[]}[]=[];for(const line of evaluationLines(e,entry)){const last=groups.at(-1);if(last?.label===line.label)last.lines.push(line.text);else groups.push({label:line.label,lines:[line.text]})}return groups}
