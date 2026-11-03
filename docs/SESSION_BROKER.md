# B4-B 메모리 세션과 요청 격리

`createIsolatedSessionBroker`는 앱에서 호출하지 않는 준비 코드다. 외부 fetch를 반드시 주입하며 테스트에서는 모든 fetch를 모의한다. 브로커 승인 API는 이미 Supabase Auth에서 검증한 OTP 세션을 전달받는 것을 전제로 한다. 이번 단계에서는 OTP 컨트롤러에 연결하지 않았으며 실제 인증·데이터 요청은 수행하지 않는다.

브로커는 access token을 클로저에만 두고 UI에 userId·만료·generation만 제공한다. 로그인/재로그인/계정 전환/로그아웃마다 generation이 바뀌고 세션 변경 시 진행 중인 요청을 중단한다. 토큰의 sub, role=authenticated, exp와 서버에서 반환된 사용자 ID·만료를 비교한다. JWT 디코딩은 서명 검증이 아니며 임의 입력을 검증된 세션으로 신뢰해서는 안 된다. 실제 Supabase Auth 세션 검증과 인증 이벤트 결합은 활성화 전에 별도로 구현·검증해야 한다. SDK 요청 내부에도 토큰이 일시적으로 전달된다.

데이터 전용 SDK는 기존 OTP fetch를 우회하거나 변경하지 않는다. 가드는 전용 HTTPS origin, 본인의 지정된 열 조회 GET과 소유자 일치 CAS RPC POST만 허용하며 다른 경로·메서드·외부 origin·쿼리·URL 자격정보를 거부한다. 리다이렉트는 fetch redirect=error로 설정한다. 브로커는 세션 교체 시 abort, 어댑터는 요청 전후 세션을 비교하고 timeout 및 retry(false)를 적용한다. 취소는 이미 서버에 도달한 쓰기를 되돌리지 않으므로 쓰기 결과는 미확정으로 다룬다.

남은 조건: 실제 SDK의 인증 이벤트와 단일 브로커의 결합, 토큰 서명·만료의 서버 검증, Data API/RLS 및 실계정 JWT 확인, 실제 배포 origin·리다이렉트 정책 검증, 서비스 키와 임의 fetch가 주입되지 않는 composition root를 검토해야 한다. 이 파일과 모의 테스트는 서버 동기화 활성화 승인이 아니다.
