# 구글 캘린더 구독(.ics 피드) 설계

## 목표
계획을 저장/수정/삭제하면 구글 캘린더에 자동 반영. 구독 주소 방식(구글이 주기적으로 읽음, 즉시 반영은 아님).

## 결정 사항 (사용자 승인)
- 방식: 사용자별 비밀 토큰이 들어간 공개 .ics 피드 (`/api/calendar/<token>`). 로그인 불필요(`/api`는 proxy matcher 제외).
- 내용: 수술명 + 날짜만(종일 일정). 환자 이름/차트번호 미포함. 완료(DONE) 계획은 제목 앞 "[완료] ".
- 범위: 오늘 기준 90일 전 이후의 계획 전부. 각 계획의 `op-plan-<id>@ess-septo`를 UID로 써서 수정/삭제가 따라가게 함.
- 계정 분리: 토큰 주인(createdById)의 계획만.
- 주소 재발급 시 기존 주소는 즉시 무효.
- 설정 화면 "캘린더 연동"에 구독 카드 추가(주소 만들기/복사/다시 만들기 + 구글 캘린더 등록 안내). 기존 개별 버튼 유지.

## 구성
1. `User.calendarToken String? @unique` (마이그레이션).
2. `src/lib/calendar.ts`: `buildIcsFeed({calendarName, events})` (다건 VEVENT, DTSTAMP=plan.updatedAt, X-WR-CALNAME, REFRESH-INTERVAL).
3. `src/lib/calendar-feed.ts`: `planToCalendarEvent(plan)`, `generateCalendarToken()`.
4. `src/app/api/calendar/[token]/route.ts`: 토큰 → 사용자 → 계획 조회 → text/calendar. 토큰 형식 불량/없음 → 404.
5. `src/app/actions/calendar.ts`: `regenerateCalendarToken()`(세션 필요, 새 토큰 저장).
6. 설정 화면 카드 + 복사 버튼.

## 테스트
피드 문자열(이스케이프/CRLF/UID/날짜), planToCalendarEvent(제목·완료 접두사·환자명 미포함), 토큰 생성(길이·URL-safe·중복 없음). 소유자 조건은 기존 ownership-guard 테스트가 검사.

## 한계
구글의 구독 갱신 주기(수 시간~하루)는 조절 불가.
