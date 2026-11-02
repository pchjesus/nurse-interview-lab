# Nurse Interview Lab

간호사 모의면접의 전사본과 평가를 개인별·면접별로 관리하는 정적 웹앱입니다. AI 분석과 음성 전사는 제공하지 않습니다. 전사와 외부 평가 표시, 브라우저 내 PDF 다운로드를 지원합니다. 실제 개인정보를 저장소에 올리지 마세요.

## 개발

Node.js 22 이상에서 `npm ci`, `npm test`, `npm run build`, `npm run dev`를 실행합니다. Vite의 GitHub Pages 경로는 `/nurse-interview-lab/`입니다. main 브랜치의 GitHub Actions가 Pages에 배포합니다. 배포 전에 저장소의 Pages 소스를 GitHub Actions로 설정해야 합니다.

[JSON 규격 및 가상 예제](docs/JSON_SCHEMA.md)를 참고하세요. 보고서는 가져오기 전에 검증되며, 사람과 참가자 ID는 별개입니다. 기본 저장은 메모리이며 설정에서 명시적으로 기기 저장을 선택할 수 있습니다. 브라우저 저장소는 같은 출처의 다른 경로와 보안상 격리되지 않습니다. 중요한 데이터는 전체 백업을 별도로 보관하세요.

PDF 및 글꼴 정보는 [PDF 안내](docs/PDF_EXPORT.md), 분석 JSON 작성은 [가져오기 안내](docs/CHATGPT_IMPORT_GUIDE.md)를 참고하세요. 브라우저 통합 검증은 `npx playwright install chromium` 후 `npm run test:e2e`로 실행하며 PDF 검증에 Poppler의 `pdfinfo`와 `pdftotext`가 필요합니다.

## 개발 상태

v0.2는 기존 1.0 형식을 유지하면서 선택적 전사·평가 필드를 추가합니다. 현재 상태·저장 경로는 가져오기, 복원, 기기 저장이 공유하므로 데이터 형식이나 동시 저장 동작을 변경할 때 회귀 검증을 다시 수행해야 합니다. 누적 결함 추세를 판단할 근거가 없어 추가 리팩터링은 보류합니다.

v0.3에서는 평가 표현을 화면과 PDF가 공유하도록 정규화하고, 새 1.1 보고서에서 ID 참조를 검증합니다. 기존 인덱스 기반 전사 편집은 고유 발화 ID가 있으면 이전하며, 이전할 수 없는 항목은 기존 순서를 유지하고 화면에 경고합니다. 이 데이터 흐름은 가져오기·백업·PDF를 공유하므로 형식 변경 시 관련 회귀 테스트를 실행해야 합니다.
