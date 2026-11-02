# PDF 내보내기

면접 상세의 응시자 카드 또는 사람 상세에서 개인별 PDF를 다운로드합니다. PDF 생성 모듈은 요청 시 로드하며 준비 중에는 버튼을 사용할 수 없습니다. 전체 면접 PDF에는 여러 사람의 정보가 포함되므로 공유 전 수신 대상과 내용을 확인하세요. 브라우저 내부에서 @react-pdf/renderer로 A4 PDF를 생성하며 데이터는 서버로 전송하지 않습니다. 화면에 표시된 질문별 연결과 평가를 사용하고, 자료가 없으면 없다고 표시합니다. 불명확한 출처를 자동 검증하지 않습니다.

글꼴은 Google Fonts에서 배포하는 정적 Nanum Gothic Regular이며 [SIL Open Font License 1.1](../public/fonts/OFL.txt)으로 배포됩니다. 글꼴은 앱에 포함되어 외부 CDN 요청이 필요 없습니다. 원본 출처: https://github.com/google/fonts/tree/main/ofl/nanumgothic .

파일명은 날짜, 응시자 또는 전체 면접, 표시 제목을 사용하고 OS 금지 문자를 치환합니다. PDF는 텍스트 선택을 지원하며 긴 내용은 페이지를 나눕니다. 원본 전사 수정사항과 사람 연결의 보관에는 전체 JSON 백업을 사용하세요.
