import React,{useEffect,useRef,useState} from 'react'
export const guideSteps=[
 {title:'CLOVA Note에서 전사하기',text:'면접 참여자의 동의를 받고 CLOVA Note에서 전사한 뒤 면접 기록에 붙여넣어 원문을 확인하세요. 전사 초안은 메모리에만 남습니다.',target:'start'},
 {title:'ChatGPT로 분석하기',text:'별도의 ChatGPT 대화에서 전사와 허용된 자료를 분석하고 JSON 1.1을 만듭니다. 확인하지 않은 교재·페이지는 미검증으로 둡니다.',target:'start'},
 {title:'JSON 가져오기',text:'면접 기록에서 JSON 파일을 선택하거나 붙여넣고 검증 및 미리보기를 선택합니다.',target:'import'},
 {title:'참여자 연결',text:'참여자마다 기존 사람을 선택하거나 새 사람으로 등록합니다. 동명이인은 자동으로 합쳐지지 않습니다.',target:'mapping'},
 {title:'피드백 확인',text:'사람별 질문과 실제 발언, 평가, 근거의 검증 상태를 확인합니다. 앱은 임상 근거를 독립적으로 검증하지 않습니다.',target:'feedback'},
 {title:'PDF 내보내기',text:'개인별 또는 전체 PDF를 내려받습니다. 전체 보고서에는 다른 사람의 개인정보가 포함될 수 있습니다.',target:'pdf'},
 {title:'전체 JSON 백업',text:'설정에서 전체 백업을 내려받으세요. 브라우저 저장은 영구 보존을 보장하지 않으며 서버에 자동 동기화되지 않습니다.',target:'backup'}
] as const
export default function Guide({step,onStep,onClose}:{step:number,onStep:(step:number)=>void,onClose:()=>void}){
 const [rect,setRect]=useState<DOMRect|null>(null);const dialog=useRef<HTMLDivElement>(null);const previous=useRef<HTMLElement|null>(null)
 useEffect(()=>{previous.current=document.activeElement as HTMLElement;return()=>{if(previous.current?.isConnected)previous.current.focus();else document.querySelector<HTMLButtonElement>('[data-guide="help"]')?.focus()}},[])
 useEffect(()=>{const move=()=>{const target=document.querySelector(`[data-guide="${guideSteps[step].target}"]`)||document.querySelector('[data-guide="nav-records"]');if(target){target.scrollIntoView({block:'center',inline:'nearest'});setRect(target.getBoundingClientRect())}else setRect(null)};const timer=window.setTimeout(move,80);dialog.current?.focus();window.addEventListener('resize',move);return()=>{clearTimeout(timer);window.removeEventListener('resize',move)}},[step])
 function key(e:React.KeyboardEvent){if(e.key==='Escape'){e.preventDefault();onClose()}if(e.key==='ArrowRight'&&step<guideSteps.length-1){e.preventDefault();onStep(step+1)}if(e.key==='ArrowLeft'&&step>0){e.preventDefault();onStep(step-1)}if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}
 const r=rect&&{top:Math.max(4,rect.top-5),left:Math.max(4,rect.left-5),width:Math.min(window.innerWidth-8,rect.width+10),height:Math.min(window.innerHeight-8,rect.height+10)}
 return <div className="guide-overlay" onKeyDown={key}><div className="guide-backdrop"/>{r&&<div className="guide-spotlight" style={r} aria-hidden="true"/>}<div className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-description" tabIndex={-1} ref={dialog}><p>사용법 {step+1} / {guideSteps.length}</p><h2 id="guide-title">{guideSteps[step].title}</h2><p id="guide-description">{guideSteps[step].text}</p><p className="guide-hint">강조된 화면을 확인하세요. 방향키로 이동하거나 Esc로 닫을 수 있습니다.</p><div className="guide-actions"><button disabled={step===0} onClick={()=>onStep(step-1)}>이전</button>{step<guideSteps.length-1?<button onClick={()=>onStep(step+1)}>다음</button>:<button onClick={()=>onStep(0)}>다시 보기</button>}<button onClick={onClose}>{step===guideSteps.length-1?'완료':'건너뛰기'}</button></div></div></div>
}
