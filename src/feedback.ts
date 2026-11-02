import {type Entry} from './model'
export const labels = {answer:'실제 답변',strengths:'잘한 점',evidence:'근거 설명',weaknesses:'부족한 점',improvements:'개선 방향',improvedAnswer:'개선 답변',overall:'종합 평가',intent:'질문 의도 충족',logic:'답변의 논리성',specificity:'경험의 구체성',sincerity:'진정성과 설득력',professionalism:'전문직 태도',communication:'의사소통과 협력',hospitalValues:'병원 가치와의 연결'} as const
export function effectiveTranscript(entry:Entry) {return entry.report.transcript.map((u,i)=>({...u,...(entry.transcriptEdits?.[String(i)]||{}), originalText:u.text, index:i}))}
export function participantFeedback(entry:Entry, participantId:string) {
 const r=entry.report, transcript=effectiveTranscript(entry)
 const questions=[...r.questions].sort((a,b)=>(typeof a.order==='number'?a.order:r.questions.indexOf(a))-(typeof b.order==='number'?b.order:r.questions.indexOf(b)))
 return questions.map(q=>({question:q, utterances:transcript.filter(t=>t.participantId===participantId&&t.questionId===q.questionId), evaluations:r.evaluations.filter(e=>e.participantId===participantId&&e.questionId===q.questionId)}))
}
export function sourcesFor(entry:Entry, participantId:string) {const ids=new Set(entry.report.evaluations.filter(e=>e.participantId===participantId).flatMap(e=>Array.isArray(e.sourceIds) ? e.sourceIds.filter((x):x is string=>typeof x==='string') : []));return entry.report.sources.filter(s=>typeof s.sourceId==='string' && ids.has(s.sourceId))}
export function safeFileName(s:string) {return s.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,160)||'보고서'}

export function sourceDescription(s:Record<string,unknown>) {const str=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'';return str(s.apa)||[s.author,s.year,s.title,s.edition,s.publisher].map(str).filter(Boolean).join(' · ')||'자료명 없음'}
