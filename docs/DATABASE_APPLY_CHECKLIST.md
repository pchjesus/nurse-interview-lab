# v0.6-B3 DB 적용 승인 검토서

상태: **조건부 검토 완료, 실제 적용 승인 보류**. 전용 대상은 `aevhsdqrirgslfetknip`이다. 2026-11-03 검토에서는 실제 Supabase에 SQL을 실행하지 않았으며 사용자 생성, 메일 발송, 데이터 이전도 수행하지 않았다. 원격 B2 기준은 `01427eed8154a223b78c6e85b8064049b620c1fc`다. 아래 확인란은 실제 확인 전 체크하지 않는다.

## 최종 SQL과 권한 검토

적용 후보의 단일 원본은 [001_nurse_backup.sql](../db/review/001_nurse_backup.sql)이다. 자동 적용 경로에 넣지 않는다. BEGIN/COMMIT 안에서 신규 객체만 생성하며 CREATE OR REPLACE, IF NOT EXISTS 또는 기존 데이터 변환은 사용하지 않는다. 같은 이름이 있으면 트랜잭션을 중단한다.

- 테이블과 RPC 소유자는 실행 시점의 관리 역할이다. 같은 소유자라고 해서 안전성이 보장되지는 않는다. 적용 전에 소유자가 신뢰할 수 있는 관리 역할인지, anon/authenticated가 해당 역할을 상속하거나 SET ROLE 할 수 없는지 확인한다. 클라이언트 역할은 소유자가 될 수 없다.
- 직접 테이블 권한은 authenticated SELECT만 허용한다. RLS는 본인 UUID 및 JSON boolean `is_anonymous: false`를 요구한다. PUBLIC·anon·authenticated의 기존 명시 권한을 철회한 후 필요한 권한만 부여한다. 다른 역할에 기본 권한이 부여되는 프로젝트는 별도 검토한다.
- SECURITY DEFINER는 호출자의 직접 쓰기 권한 없이 CAS를 수행하기 위해 유지한다. 빈 search_path, 스키마 한정 이름, 동적 SQL 없음, 예상 소유자 대조가 적용된다. 테이블 소유자 또는 BYPASSRLS 역할로 실행되므로 RLS가 RPC를 보호한다고 가정하지 않는다.
- PUBLIC·anon EXECUTE를 철회하고 authenticated에만 RPC 실행을 허용한다. public은 의도적으로 Data API에 노출되는 RPC 경계다. private DEFINER + public INVOKER wrapper 대안은 권한 경계를 더 분리하지만 추가 객체·권한이 필요하며 이번 변경에서는 도입하지 않는다. 해당 RPC 노출 자체에 대한 승인도 필요하다.
- auth.role()의 기존 소스는 JWT role을 읽는 도우미다. DEFINER 안의 current_user는 함수 소유자로 바뀌므로 인증 역할 판정 대안이 될 수 없다. 최종안은 auth.jwt()->>'role'로 직접 검사한다. 도우미가 설치된 프로젝트에서 제거·폐기됐다고 단정하지 않는다.
- JWT is_anonymous가 빠졌거나 문자열 "false"면 거부한다. 이메일 OTP 토큰이 실제로 boolean false와 올바른 role/sub를 제공하는지는 미검증이다. 클라이언트 디코딩은 권한 증명이 아니며 서버의 JWT 검증 설정 확인이 필요하다. user_metadata로 대체하지 않는다.
- DB는 백업 envelope만 검증하며 중첩 보고서의 완전한 참조 무결성을 보장하지 않는다. 전체 백업 format_version 1.0과 개별 보고서 schemaVersion 1.0/1.1을 구분한다. 크기 제한·보존·삭제·운영 복구 정책이 마련되기 전 실제 데이터 동기화는 활성화하지 않는다.

## 적용 전 확인표 (모두 미확인)

- [ ] 대상 프로젝트 ID·DB·환경과 관리 역할을 확인하고 변경 시간을 기록했다.
- [ ] [000_preflight.sql](../db/review/000_preflight.sql)의 메타데이터 점검을 별도 승인 후 실행했다. 현재는 준비만 했으며 실제 프로젝트에서 실행하지 않았다.
- [ ] nurse_backups 관계 이름, save_nurse_backup의 모든 overload, 기존 정책·데이터·의존성과 충돌이 없다. 발견 시 덮어쓰지 않고 중단한다.
- [ ] auth.users(id), auth.uid(), auth.jwt(), public 스키마 사용 권한과 신뢰 가능한 정의·소유자를 확인했다.
- [ ] 역할 상속, 기본 ACL, 이벤트 트리거, exposed schemas 및 인증 JWT 검증 설정을 확인했다. 기존 정책과 설정이 알려지지 않았으므로 충돌 없음이라고 판단할 수 없다.
- [ ] 실제 이메일 OTP JWT의 boolean is_anonymous=false, role=authenticated, sub UUID가 서버에 전달되는 것을 안전하게 확인했다. 토큰 원문은 로그·저장소에 남기지 않는다.
- [ ] 대상 DB의 복구 가능한 백업·복원 연습·보존 및 삭제 절차를 확보했다.
- [ ] 고정된 적용 SQL 커밋을 검토하고 사용자에게 DB 적용만 별도로 승인받았다. 이 승인은 서버 동기화나 실제 데이터 이전 승인을 포함하지 않는다.

## 적용 순서 및 실패 대응

1. 위 조건이 충족되지 않으면 중단한다. 프로젝트 연결·키·JWT를 임의 생성하거나 추측하지 않는다.
2. 승인된 관리자가 동일 세션에서 SQL을 ON_ERROR_STOP으로 전체 실행한다. lock_timeout·statement_timeout을 정하고 무한 대기를 피한다. 별도 관리자 변경을 중지하고 객체 충돌을 다시 확인한다.
3. 오류 시 세션에서 ROLLBACK한다. SQL이 자동 커밋 단위로 나뉘는 도구는 사용하지 않는다. 이미 COMMIT됐는지 불분명하면 재실행하지 않고 메타데이터를 조회해 실제 상태를 확인한다.
4. 커밋 후 소유자·RLS·ACL·함수 정의·예상 시그니처를 재확인한다. 데이터 API 검증은 별도 승인된 테스트 계정 A/B와 비로그인 세션으로 수행한다. 이 단계에서는 사용자 생성이나 메일 발송을 승인받지 않았다.
5. 검증 실패 시 앱의 서버 기능은 계속 비활성으로 유지한다. authenticated의 RPC EXECUTE와 테이블 SELECT를 관리자가 철회해 접근을 우선 차단하고 원인을 조사한다. 이것만으로 이미 처리 중인 요청이 취소되지는 않는다.
6. 빈 신규 객체만 생성됐고 의존성이 없다는 확인과 삭제 승인이 있으면 정확한 RPC 시그니처를 DROP한 뒤 테이블을 DROP한다. CASCADE는 사용하지 않는다. 데이터가 있으면 DROP하지 않고 접근을 막은 상태로 백업·복원 계획을 별도로 검토한다. 계정 삭제는 FK RESTRICT로 차단될 수 있다.

## 검증 근거와 남은 조건

PGlite 보안 SQL 및 일회성 로컬 PostgreSQL 18.6 두 연결 시험은 통과했다. 생성 경쟁과 동일 revision 수정은 각각 성공 1건/충돌 1건이었다. auth.role() 대체 후 동일 시험을 재실행해 통과했으며 메타데이터 사전점검 SQL도 로컬에서 구문·실행 검증했다. 기존 앱 소스와 CI의 전체 회귀 작업은 유지한다. 실제 Supabase의 객체·역할·정책·JWT·PostgREST 및 복구는 미검증이다. 따라서 검토 자료는 준비됐지만 실제 적용 가능 확정 또는 운영 준비 완료로 보고하지 않는다.

공식 근거 (2026-11-03 공식 GitHub 원문 확인, 라이브 프로젝트 상태와 다름):

- [Supabase 함수 권한·SECURITY DEFINER](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/functions.mdx)
- [Supabase RLS·JWT](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx)
- [auth.role 역사적 함수 정의](https://github.com/supabase/auth/blob/master/migrations/20211124214934_update_auth_functions.up.sql)
