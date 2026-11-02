# Nurse Interview Lab

간호사 모의면접의 전사본과 간호학적 근거 기반 피드백을 개인별·면접별로 관리하는 GitHub Pages 웹앱입니다.

## 예정 기능

- ChatGPT 분석 결과 JSON 가져오기
- 사람별 프로필 및 면접 기록 관리
- 결과본 제목 수정, 검색, 정렬, 필터
- 간호직무·인성면접 평가 확인
- 개인별 평가 보고서 및 PDF 출력
- JSON 백업 및 복원
- 브라우저 내 데이터 처리

## 기술 스택

- React + TypeScript + Vite
- GitHub Pages
- JSON 및 선택적 IndexedDB

## 보안 원칙

- 실제 녹음본, 전사본, 교재 PDF, 면접 평가 데이터는 GitHub에 저장하지 않습니다.
- 백엔드, Supabase, 외부 AI API를 사용하지 않습니다.
- 사용자 데이터의 자동 서버 업로드와 자동 동기화는 지원하지 않습니다.
