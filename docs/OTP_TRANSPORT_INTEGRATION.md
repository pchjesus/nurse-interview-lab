# B4-C 비활성 OTP·전송 통합

`createInactiveOtpTransport`는 기존 `EmailOtpAuth`와 데이터 브로커를 클로저에서 구성한다. 앱 진입점에는 연결하지 않는다. 공개 객체에는 인증 명령과 CloudTransport만 제공하며 브로커의 approve 함수와 JWT를 노출하지 않는다. 이메일 OTP 클라이언트는 기존 인증 전용 fetch만 사용하며 데이터 fetch는 별도 주입 경로와 기존 가드를 사용한다. 구성만으로 OTP 또는 데이터 요청을 보내지 않는다.

인증 코드 처리에서 서버의 verifyOtp 성공 응답과 사용자 ID·이메일·세션·만료를 확인한 후에만 비공개 lifecycle을 통해 broker.approve를 호출한다. 오류·취소·로그아웃 시작·만료·SIGNED_OUT·계정 변경 또는 새 SIGNED_IN은 브로커를 즉시 무효화하고 진행 중 요청을 취소한다. 늦게 돌아온 OTP 결과는 epoch 검사를 통과하지 못한다. 재로그인 시 generation이 변경된다. UI 상태에는 JWT가 포함되지 않는다. SDK 성공 응답은 인증 클라이언트 경계에서 온 것이어야 하며 JWT 디코딩은 서명 검증이 아니다.

기존 독립 `createIsolatedSessionBroker`의 approve는 여전히 모의 준비용 API로 임의 호출할 수 있다. 실사용 경계로 직접 노출해서는 안 된다. 통합 factory의 브로커는 외부에 노출되지 않지만 주입된 데이터 fetch, SDK, 인증 코드, 배포 origin이 신뢰 가능해야 한다. 실제 활성화 전에 인가된 composition root·토큰 처리·세션 이벤트·서명 검증 및 RLS/PostgREST를 실환경에서 별도 검토해야 한다.

RPC 가드는 정확히 네 인자만 허용하고 소유자, 양의 안전 revision 또는 null, 백업 형식 1.0 및 전체 백업 schema를 검증한다. 기존 CloudRepository의 CAS·저장 확인 재조회는 유지한다. 요청 중 세션 전환 시 서버에 도달한 쓰기가 취소된다고 보장하지 않으므로 결과를 미확정으로 처리한다. 실계정·실제 Supabase 요청·DB 변경은 하지 않았다.
