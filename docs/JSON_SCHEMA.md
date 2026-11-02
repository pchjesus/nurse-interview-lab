# JSON 규격: 권장 1.1 및 기존 1.0 호환

개별 면접 보고서와 전체 백업은 서로 다른 형식입니다. UTF-8 JSON, 최대 5 MiB. 신규 보고서에는 `schemaVersion: "1.1"`을 권장하며 기존 `"1.0"` 보고서도 지원합니다. 다른 버전은 거부합니다. 전체 백업의 형식 버전은 별도로 `"1.0"`입니다. ID는 비어 있지 않은 문자열이며 같은 보고서의 participantId는 유일해야 합니다. 날짜는 실제 존재하는 `YYYY-MM-DD`입니다. 참여자별 발화 및 평가의 participantId는 participants에 존재해야 합니다. 추가 속성은 원본에 보존됩니다.

## 기존 1.0 개별 보고서 예시 (모두 가상)

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

1.0의 `session.type`은 기존 `직무`·`인성`을 지원하며 `혼합`도 허용합니다. `session.title`, `topic`은 선택 사항입니다. `questions`, `transcript`, `evaluations`, `sources`는 빈 배열을 허용합니다. 평가와 출처의 추가 속성은 자유 형식으로 보존하며, 앱은 평가를 검증된 사실이나 공식 점수로 간주하지 않습니다. 실제 답변이 없는 참여자에 대한 평가를 생성하지 않습니다. 사람의 로컬 ID는 보고서에 포함할 필요가 없습니다.

## 전체 백업

`kind`가 `nurse-interview-lab-backup`인 JSON으로 보고서와 구별합니다. `people`에는 `{personId, name, alias}`가, `reports`에는 `{report, links, displayTitle, modifiedAt}`이 들어갑니다. `links`는 participantId를 personId에 연결하는 객체이며 `displayTitle`은 문자열 또는 null, `modifiedAt`은 UTC ISO 날짜시각입니다. 사람과 보고서 ID는 각각 유일해야 하고 모든 연결은 실제 사람과 참여자를 가리켜야 합니다. 복원은 전체 검증 후 현재 데이터를 교체합니다.

```json
{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}
```

IndexedDB 사용 여부는 기기별 선택이므로 백업에 포함하지 않습니다. 원본 보고서 내보내기에는 로컬 제목과 사람 연결이 포함되지 않습니다. 이를 보존하려면 전체 백업을 사용하세요.

## 기존 1.0의 선택 필드

기존 1.0 파일을 그대로 읽습니다. 다음 필드는 없어도 되며, 빠진 시각이나 출처를 만들어내지 않습니다.

- `participants[]`: `role`은 `면접관`, `응시자`, `미확인` 중 하나입니다. 로컬 personId는 보고서가 아닌 백업의 `links`에 저장합니다.
- `questions[]`: `type` (`직무`, `인성`, `미분류`), 숫자 `order`, 문자열 `matchStatus`, 불리언 `uncertain`.
- `transcript[]`: `utteranceId`, 숫자 `order`, 문자열 `startTime`, `endTime`, `questionId`, 불리언 `unclear`.
- `evaluations[]`: `participantId`, `questionId`, `answer`, `strengths`, `evidence`, `weaknesses`, `improvements`, `improvedAnswer`, `overall`, `sourceIds`, `verificationStatus`. 인성 항목은 `intent`, `logic`, `specificity`, `sincerity`, `professionalism`, `communication`, `hospitalValues`를 사용합니다. 1.0은 기존 자유 형식을 보존하며, 신규 작성에는 아래의 1.1 규격을 사용합니다.
- `sources[]`: `sourceId`, `author`, `year`, `title`, `edition`, `publisher`, `pages`, `apa`, `verified`. 확인되지 않은 출처는 `verified: false` 또는 생략합니다. 입력상 확인 표시는 앱이 출처를 독립 검증했다는 뜻이 아닙니다.

백업의 각 보고서 항목에는 선택적 `transcriptEdits`가 추가됩니다. 원본 배열 인덱스를 키로 하고 수정된 `text`, `participantId`, `questionId`를 값으로 저장합니다. 보고서 원본은 바꾸지 않으며 전체 백업으로 수정본을 보존합니다. 원본 개별 JSON 내보내기에는 수정사항이 포함되지 않습니다.

v0.1은 추가 필드를 자유 형식으로 허용했기 때문에 기존 데이터를 보존하려고 위 선택 필드의 형식이 다르더라도 가져오기를 거부하지 않습니다. 앱은 인식할 수 없는 선택 필드를 표시하거나 연결하지 못할 수 있습니다. 필수 ID·날짜·배열과 기본 연결 검증은 계속 적용됩니다. 신규 JSON은 위에 명시된 형식을 따라야 합니다.

## 권장 보고서 1.1

1.0 보고서와 앱 백업은 계속 읽습니다. 신규 보고서는 `schemaVersion: "1.1"`을 사용합니다. reportId는 면접, participantId는 녹음 속 화자, personId는 로컬 프로필, questionId는 질문, utteranceId는 발화, sourceId는 참고문헌을 식별합니다. personId는 로컬 백업의 links에만 저장합니다.

1.1은 모든 participant의 `role`, question의 `type`과 `order`, transcript의 고유 `utteranceId`와 `order`, 평가의 participantId·questionId, 출처의 sourceId를 요구합니다. ID 중복과 존재하지 않는 참조, 다른 참가자·질문에 속한 발화 참조는 가져오기 오류입니다. session.type은 `직무`, `인성`, `혼합`입니다. 각 질문은 독립적인 `직무`, `인성`, `미분류`를 갖습니다. 지원하지 않는 필드와 잘못된 형식도 1.1에서 오류로 처리합니다.

`strengths`, `weaknesses`는 문자열, 문자열 배열 또는 구조화된 객체(배열)를 받습니다. 객체는 `content`를 필수로 하고 `quote`, `utteranceIds`, `reason`, `nursingEvidence`, `importance`, `improvement`, `references`를 선택적으로 받습니다. 각 reference는 `sourceId`, 선택적 `pages`, 선택적 `verified`입니다. `verified`는 분석자의 입력이며 앱의 독립 검증이 아닙니다. 확인되지 않은 페이지는 생략하거나 `verified: false`로 표시하세요.

```json
{"schemaVersion":"1.1","reportId":"example","session":{"date":"2026-11-02","type":"혼합","hospital":"가상병원"},"participants":[{"participantId":"a","name":"가상 응시자","role":"응시자"}],"questions":[{"questionId":"q1","text":"가상 질문","type":"직무","order":1},{"questionId":"q2","text":"가상 인성 질문","type":"인성","order":2}],"transcript":[{"utteranceId":"u1","participantId":"a","questionId":"q1","text":"가상 발언","order":1}],"evaluations":[{"participantId":"a","questionId":"q1","strengths":[{"content":"가상 장점","utteranceIds":["u1"],"reason":"판단 이유","nursingEvidence":"가상 근거","references":[{"sourceId":"s1","pages":"12","verified":false}]}],"weaknesses":[{"content":"부족한 점","importance":"중요성","improvement":"개선 방법"}],"improvedAnswer":"가상 개선 제안"}],"sources":[{"sourceId":"s1","apa":"가상 출처","verified":false}]}
```

백업은 1.0 형식을 유지하며 선택적 `transcriptEditsById`에 발화 ID별 수정값을 저장합니다. 이전 인덱스 수정은 유일한 발화 ID가 있을 때 자동 이전합니다. ID가 없거나 중복·충돌하면 기존 수정과 순서를 보존하고 경고합니다. 원본 보고서는 수정하지 않습니다.

### 이전 전사 수정 충돌 복구

설정에서 **전체 백업**을 먼저 다운로드하세요. 면접 상세의 `이전 수정 내역 확인 및 복구`에서 인덱스 수정과 ID 수정이 충돌하면 원문과 두 수정 내역을 비교한 뒤 사용할 쪽을 선택할 수 있습니다. 선택하지 않은 수정은 활성 데이터에서 제거되므로 원래 전체 백업을 별도 보관하세요. 고유 ID가 없거나 중복된 경우 앱은 임의로 연결하지 않습니다. 복구용 JSON에서 내용을 확인하고 원본 순서와 함께 백업을 보관하세요. 원본을 대조해 대상 발화의 고유 ID를 확인한 경우 화면에서 직접 연결할 수 있으며 이미 수정된 발화는 덮어쓰지 않습니다. 수동으로 전체 백업을 정정하려면 사본에서만 작업한 후 복원 미리 확인을 거치고, 확신할 수 없으면 기존 상태를 유지하세요. 복구용 개별 기록 JSON은 전체 백업을 대체하지 않습니다.
