import {useRef, useState} from 'react'

const MAX_BYTES=5*1024*1024

type Props={value:string;onChange:(text:string)=>void}

/** An in-memory draft only; it never touches report data or browser storage. */
export default function ClovaTranscript({value,onChange}:Props){
 const [notice,setNotice]=useState('')
 const [error,setError]=useState('')
 const input=useRef<HTMLTextAreaElement>(null)
 const hasText=value.trim().length>0
 let characters=0;for(const _ of value)characters++
 function change(text:string){
  if(text.length>MAX_BYTES||new TextEncoder().encode(text).byteLength>MAX_BYTES){setError('전사본은 UTF-8 기준 5MiB 이하여야 합니다. 입력이 너무 커서 추가하지 않았습니다.');setNotice('');return}
  onChange(text);setError('');setNotice('')
 }
 async function copy(){
  if(!hasText){setError('복사할 전사본을 입력해 주세요.');return}
  try{
   if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable')
   await navigator.clipboard.writeText(value)
   setError('');setNotice('전사본을 복사했습니다.')
  }catch{
   setNotice('');setError('복사하지 못했습니다. 입력창의 내용을 직접 선택해 복사해 주세요.')
   input.current?.focus();input.current?.select()
  }
 }
 function clear(){if(value&&confirm('임시 전사본을 지울까요?')){onChange('');setNotice('전사본을 지웠습니다.');setError('')}}
 return <section className="card clova-transcript" aria-labelledby="clova-title">
  <h2 id="clova-title">CLOVA 전사본 입력</h2>
  <p>CLOVA Note에서 복사한 전사 텍스트를 붙여넣고 원문을 확인하세요. 질문이나 화자를 자동으로 분석하지 않습니다.</p>
  <p>이 초안은 메모리에만 남습니다. 탭을 이동해도 유지되지만 새로고침하거나 창을 닫으면 사라집니다. 기기 저장을 켜도 저장되거나 전체 백업에 포함되지 않습니다.</p>
  <label htmlFor="clova-text">CLOVA 전사본 텍스트</label>
  <textarea id="clova-text" ref={input} rows={8} value={value} onChange={event=>change(event.currentTarget.value)} aria-describedby="clova-count clova-help"/>
  <p id="clova-help">{hasText?'입력한 내용은 자동으로 수정되지 않습니다.':'전사본을 입력해 주세요. 공백만 입력하면 복사할 수 없습니다.'}</p>
  <p id="clova-count">문자 수: {characters.toLocaleString('ko-KR')}자</p>
  <button type="button" onClick={()=>void copy()} disabled={!hasText}>원문 복사</button>{' '}
  <button type="button" onClick={clear} disabled={!value}>전사본 지우기</button>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {hasText&&<><h3>원문 미리보기</h3><pre className="clova-preview" aria-label="전사본 원문 미리보기">{value}</pre></>}
 </section>
}
