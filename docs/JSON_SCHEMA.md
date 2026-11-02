# JSON 형식 1.0

개별 면접 보고서와 전체 백업은 서로 다른 형식입니다. UTF-8 JSON, 최대 5 MiB. `schemaVersion`은 문자열 `"1.0"`이며 다른 버전은 자동 변환하지 않고 거부합니다. 이후 버전에서 명시적인 마이그레이션이 필요합니다. ID는 비어 있지 않은 문자열이며 같은 보고서의 participantId는 유일해야 합니다. 날짜는 실제 존재하는 `YYYY-MM-DD`입니다. 참여자별 발화 및 평가의 participantId는 participants에 존재해야 합니다. 추가 속성은 원본에 보존됩니다.

## 개별 보고서 예시 (모두 가상)

```json
{
  "schemaVersion": "1.0",
  "reportId": "sample-001",
  "session": {"date": "2026-11-02", "type": "직무", "hospital": "가상병원", "title": "환자안전 연습", "topic": "낙상"},
  "participants": [{"participantId": "speaker-a", "name": "김예시"}, {"participantId": "speaker-b", "name": "김예시"}],
  "questions": [{"questionId": "q1", "text": "낙상 예방 방법은?"}],
  "transcript": [{"participantId": "speaker-a", "text": "위험 요인을 확인합니다."}],
  "evaluations": [{"participantId": "speaker-a", "strengths": ["위험 확인"], "evidence": [], "improvedAnswer": "", "verificationStatus": "미검증"}],
  "sources": [{"citation": "가상 참고문헌", "pages": "1"}]
}
```

`session.type`은 `직무` 또는 `인성`입니다. `session.title`, `topic`은 선택 사항입니다. `questions`, `transcript`, `evaluations`, `sources`는 빈 배열을 허용합니다. 평가와 출처의 추가 속성은 자유 형식으로 보존하며, 앱은 평가를 검증된 사실이나 공식 점수로 간주하지 않습니다. 실제 답변이 없는 참여자에 대한 평가를 생성하지 않습니다. 사람의 로컬 ID는 보고서에 포함할 필요가 없습니다.

## 전체 백업

`kind`가 `nurse-interview-lab-backup`인 JSON으로 보고서와 구별합니다. `people`에는 `{personId, name, alias}`가, `reports`에는 `{report, links, displayTitle, modifiedAt}`이 들어갑니다. `links`는 participantId를 personId에 연결하는 객체이며 `displayTitle`은 문자열 또는 null, `modifiedAt`은 UTC ISO 날짜시각입니다. 사람과 보고서 ID는 각각 유일해야 하고 모든 연결은 실제 사람과 참여자를 가리켜야 합니다. 복원은 전체 검증 후 현재 데이터를 교체합니다.

```json
{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}
```

IndexedDB 사용 여부는 기기별 선택이므로 백업에 포함하지 않습니다. 원본 보고서 내보내기에는 로컬 제목과 사람 연결이 포함되지 않습니다. 이를 보존하려면 전체 백업을 사용하세요.
