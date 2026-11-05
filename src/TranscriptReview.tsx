import {useState} from 'react'

type Role='면접관'|'응시자'|'미확인'
type QuestionType='직무'|'인성'|'미분류'
type Speaker={id:string;label:string;name:string;role:Role}
type Question={id:string;text:string;type:QuestionType}
export type Review={speakers:Speaker[];questions:Question[];needsReview:boolean}
export const emptyReview=():Review=>({speakers:[],questions:[],needsReview:false})
type Props={original:string;review:Review;onChange:(review:Review)=>void}

/** Student-entered notes only. No parsing, inference, or persistent data. */
export default function TranscriptReview({original,review,onChange}:Props){
 const [label,setLabel]=useState(''),[name,setName]=useState(''),[role,setRole]=useState<Role>('미확인')
 const [question,setQuestion]=useState(''),[type,setType]=useState<QuestionType>('미분류'),[error,setError]=useState('')
 function addSpeaker(){if(!label.trim()||!name.trim()){setError('화자 표기와 표시 이름 또는 가명을 입력해 주세요.');return}onChange({...review,speakers:[...review.speakers,{id:crypto.randomUUID(),label,name,role}]});setLabel('');setName('');setRole('미확인');setError('')}
 function addQuestion(){if(!question.trim()){setError('질문 내용을 입력해 주세요.');return}onChange({...review,questions:[...review.questions,{id:crypto.randomUUID(),text:question,type}]});setQuestion('');setType('미분류');setError('')}
 function move(index:number,direction:number){const target=index+direction;if(target<0||target>=review.questions.length)return;const questions=[...review.questions];[questions[index],questions[target]]=[questions[target],questions[index]];onChange({...review,questions})}
 return <section className="card transcript-review" aria-labelledby="transcript-review-title">
  <h2 id="transcript-review-title">화자와 질문 직접 확인</h2>
  <p>원문을 보고 필요한 정보만 직접 정리하세요. 입력은 선택 사항이며 앱이 화자나 질문을 추론하거나 사실 여부를 검증하지 않습니다. 전사본과 확인 정보는 메모리에만 남고 기기 저장과 전체 백업에 포함되지 않습니다.</p>
  {review.needsReview&&<div className="notice" role="status"><p>원문이 변경되었습니다. 화자와 질문 정보를 다시 확인해 주세요.</p><button type="button" onClick={()=>onChange({...review,needsReview:false})}>확인 정보 재검토 완료</button></div>}
  {error&&<p role="alert">{error}</p>}
  <h3>화자 추가</h3>
  <label>원문 화자 표기<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="예: 화자 1"/></label>
  <label>표시 이름 또는 가명<input value={name} onChange={e=>setName(e.target.value)}/></label>
  <label>새 화자 역할<select value={role} onChange={e=>setRole(e.target.value as Role)}><option>미확인</option><option>면접관</option><option>응시자</option></select></label>
  <button type="button" onClick={addSpeaker}>화자 추가</button>
  {review.speakers.length===0&&<p>등록된 화자가 없습니다.</p>}
  {review.speakers.map((speaker,i)=><fieldset key={speaker.id} className="review-item"><legend>화자 {i+1}</legend>
   <label>화자 표기 {i+1}<input value={speaker.label} onChange={e=>onChange({...review,speakers:review.speakers.map(x=>x.id===speaker.id?{...x,label:e.target.value}:x)})}/></label>
   <label>화자 이름 {i+1}<input value={speaker.name} onChange={e=>onChange({...review,speakers:review.speakers.map(x=>x.id===speaker.id?{...x,name:e.target.value}:x)})}/></label>
   <label>화자 역할 {i+1}<select value={speaker.role} onChange={e=>onChange({...review,speakers:review.speakers.map(x=>x.id===speaker.id?{...x,role:e.target.value as Role}:x)})}><option>미확인</option><option>면접관</option><option>응시자</option></select></label>
   <button type="button" onClick={()=>{if(confirm(`화자 ${i+1}의 확인 정보를 삭제할까요?`))onChange({...review,speakers:review.speakers.filter(x=>x.id!==speaker.id)})}}>화자 {i+1} 삭제</button>
  </fieldset>)}
  <h3>질문 추가</h3>
  <label>새 질문 내용<textarea rows={3} value={question} onChange={e=>setQuestion(e.target.value)}/></label>
  <label>새 질문 유형<select value={type} onChange={e=>setType(e.target.value as QuestionType)}><option>미분류</option><option>직무</option><option>인성</option></select></label>
  <button type="button" onClick={addQuestion}>질문 추가</button>
  {review.questions.length===0&&<p>등록된 질문이 없습니다. 원문만 확인해도 됩니다.</p>}
  {review.questions.map((item,i)=><fieldset key={item.id} className="review-item"><legend>질문 {i+1}</legend>
   <label>질문 내용 {i+1}<textarea rows={3} value={item.text} onChange={e=>onChange({...review,questions:review.questions.map(x=>x.id===item.id?{...x,text:e.target.value}:x)})}/></label>
   <label>질문 유형 {i+1}<select value={item.type} onChange={e=>onChange({...review,questions:review.questions.map(x=>x.id===item.id?{...x,type:e.target.value as QuestionType}:x)})}><option>미분류</option><option>직무</option><option>인성</option></select></label>
   <div className="review-actions"><button type="button" disabled={i===0} onClick={()=>move(i,-1)}>질문 {i+1} 위로</button><button type="button" disabled={i===review.questions.length-1} onClick={()=>move(i,1)}>질문 {i+1} 아래로</button><button type="button" onClick={()=>{if(confirm(`질문 ${i+1}을 삭제할까요?`))onChange({...review,questions:review.questions.filter(x=>x.id!==item.id)})}}>질문 {i+1} 삭제</button></div>
  </fieldset>)}
  <details><summary>원문과 확인 정보 함께 미리보기</summary><p>직접 입력한 확인 정보이며 앱이 검증한 사실은 아닙니다.</p>
   {review.needsReview&&<p>원문 변경 후 확인 정보를 다시 검토해 주세요.</p>}
   <h3>전사 원문</h3>{original?<pre className="clova-preview" aria-label="함께 보는 전사 원문">{original}</pre>:<p>입력된 원문이 없습니다.</p>}
   <h3>화자 확인 정보</h3>{review.speakers.length?<ul>{review.speakers.map(s=><li key={s.id}>{s.label} · {s.name} · {s.role}</li>)}</ul>:<p>등록된 화자 없음</p>}
   <h3>질문 확인 정보</h3>{review.questions.length?<ol>{review.questions.map(q=><li key={q.id}><span>{q.type}</span><p className="review-question">{q.text}</p></li>)}</ol>:<p>등록된 질문 없음</p>}
  </details>
 </section>
}
