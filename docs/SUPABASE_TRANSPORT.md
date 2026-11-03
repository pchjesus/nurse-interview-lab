# v0.6-B4-A 전송 어댑터 준비

`src/cloud/supabaseTransport.ts`의 `SupabaseCloudTransport`는 기존 `CloudTransport`를 구현한다. 앱 진입점·인증 UI에서 import하거나 생성하지 않는다. 생성만으로 SDK 클라이언트 생성, 인증 또는 네트워크 요청을 하지 않는다. 실제 서버·DB에는 연결하지 않았다.

## 계약과 응답

주입받은 SDK 클라이언트로 `nurse_backups`에서 필요한 다섯 열만 선택하고 owner_id를 필터한다. RLS가 최종 조회 권한을 결정한다. 저장은 `save_nurse_backup`에 p_expected_owner_id, p_expected_revision, p_format_version, p_backup을 전달한다. 직접 INSERT/UPDATE/DELETE는 사용하지 않는다. SQL과 service_role 권한은 변경하지 않는다.

owner_id/format_version/updated_at을 ownerId/formatVersion/updatedAt으로 변환하며 양의 안전 정수 revision, ISO 시각, 전체 백업을 검증한다. 전체 백업 formatVersion은 1.0이며 그 안의 보고서 schemaVersion 1.0/1.1과 다르다. RPC의 단일 객체 또는 정확히 한 행인 배열만 수락한다. 저장 응답의 소유자·다음 revision·백업 내용이 요청과 일치해야 한다. 백업을 임의 정규화하거나 평가를 변경하지 않는다. CloudRepository는 이후 재조회까지 수행해 저장 확정을 판단한다.

## 세션 경계와 향후 활성화 조건

MemorySessionBinding은 userId, expiresAt(Unix milliseconds), generation만 가진다. JWT를 갖거나 저장·로그하지 않는다. 메모리 세션 제공자는 매번 현재 상태를 반환하고 로그인·로그아웃·동일 계정 재로그인·계정 전환마다 generation을 바꿔야 한다. 어댑터는 요청 전후 주체·세대·만료를 검사한다. 이 값은 클라이언트 안전 검사이며 서버 접근 제어를 대신하지 않는다. 최종 권한은 서버 JWT 검증과 RLS/RPC가 판단한다.

현재 OTP 클라이언트의 인증 전용 fetch 허용 목록과 전체 비활성 클라이언트를 확장하거나 우회하지 않는다. 현재 두 클라이언트를 어댑터에 연결해도 데이터 요청은 차단돼야 한다. 인증 컨트롤러 또는 앱 상태에 토큰 노출 경로를 추가하지 않았다.

향후 별도 승인된 활성화 단계에서는 단일 메모리 세션 broker가 인증 세션과 generation을 소유하고, 데이터 전용 SDK의 accessToken callback에 현재 일반 사용자 토큰만 제공하는 구조를 검토한다. 별도 토큰 영구 저장·setSession 복사·자동 갱신·로그는 도입하지 않는다. 동일 계정 여부를 callback과 실제 전송 직전에도 확인하고, RPC expected owner로 서버에서도 계정 변경 경쟁을 차단한다. 해당 broker와 데이터 클라이언트는 이번 단계에 구현하지 않았다.

데이터용 fetch는 전용 프로젝트 HTTPS origin, 정확한 조회/RPC 경로·메서드·쿼리·본문만 허용하고 리다이렉트·임의 fetch·다른 프로젝트를 차단해야 한다. 타임아웃과 취소를 유지하고 SDK의 전송 재시도도 끈다. 공개 publishable key만 허용하는 기존 검증을 통과한 클라이언트를 신뢰된 composition root에서 주입해야 한다. 관리자/service_role 클라이언트 주입은 금지하며 타입이나 사용자 표시 상태가 이를 보장한다고 가정하지 않는다. 이 경계·실계정 JWT·Data API·RLS 검증 전 앱에서 활성화하지 않는다.

## 오류와 결과 미확정

기존 CloudError 계약은 유지한다. 추가 SupabaseTransportError.kind로 원인을 구분한다.

| 상황 | code / kind |
|---|---|
| 요청 전 로그인 없음·만료 | unauthenticated / authentication |
| 요청 전 소유자 불일치, 조회 중 계정 변경 | ownership / session-changed |
| 서버의 명시적 403·42501 | ownership / permission-denied |
| 서버의 명시적 401 | unauthenticated / authentication |
| 정확한 P0001 + revision_conflict | conflict / conflict |
| 잘못된 입력 또는 서버 22023 | invalid-data / invalid-input |
| 조회 네트워크·타임아웃·잘못된 응답 | invalid-data / network, timeout, invalid-response |
| 저장 네트워크·타임아웃·확인 불가능한 응답 | unconfirmed / network, timeout, invalid-response |
| 전송 후 저장 중 세션 변경 | unconfirmed / session-changed |

서버의 원문 오류·details·JWT·보고서 내용을 오류 메시지로 전파하지 않는다. 타임아웃은 요청을 취소하지만 서버 커밋 취소를 보장하지 않는다. 재전송하지 않고 같은 주체로 다시 조회해 확인한다. 두 SDK 경로 모두 retry(false)이며 CloudRepository도 자동 재시도하지 않는다. 원인이 확정된 충돌·권한 오류와 네트워크 미확정을 구분하고 로컬 기록은 보존한다.

## 검증 범위

SDK의 실제 PostgREST query builder를 사용하되 모든 fetch를 가상 응답으로 가로챈 단위 테스트를 작성했다. 실제 인증·메일·업로드는 수행하지 않는다. 정상 조회·최초/수정 저장·저장 후 재조회, 명시적 오류·재시도 금지·타임아웃·변형 응답·계정 전환·만료를 검증한다. 기존 SQL·브라우저 CI 작업은 유지한다. 실제 PostgREST의 응답 형태와 JWT 전달, 세션 broker 및 네트워크 경계는 향후 실환경 검증 대상이다.

로컬 검증 결과: 어댑터 25개를 포함한 Vitest 74개 통과/0 실패/0 건너뜀. 기본 Playwright 36개 통과/0 실패/4 설정별 건너뜀, 모의 인증 E2E 4개 통과/0 실패/1 기본설정 전용 건너뜀. PGlite 및 일회성 PostgreSQL 보안 assertion 각각 38개, PostgreSQL 생성·수정 두 연결 경합 2개 통과. TypeScript·기본/모의 Vite 빌드 통과. 기존 PDF 청크 크기 경고는 남아 있다. 원격 GitHub Actions 결과는 별도 확인이 필요하다.
