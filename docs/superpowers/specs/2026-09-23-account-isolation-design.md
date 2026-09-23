# 계정별 데이터 분리 및 가입 제한 설계

## 배경
보안 점검 결과, 로그인만 하면 다른 계정이 등록한 환자·계획·기록을 모두 조회/수정/삭제할 수 있고
누구나 회원가입할 수 있다. 사용 형태는 "혼자 사용"이며 DB 계정은 하나뿐이다.

## 결정 사항
- 접근 방식 A: 모든 읽기/수정/삭제 쿼리에 `createdById = 로그인 사용자` 조건을 명시적으로 붙인다.
- 가입 제한: 환경변수 `ALLOWED_EMAILS`(쉼표 구분, 대소문자 무시)에 있는 이메일만 가입 가능. 값이 비어 있으면 가입 전부 차단(fail closed). 로그인은 영향 없음.
- 수술 종류(SurgeryType)는 전 계정 공유. 프리셋은 기존처럼 createdById 기준.
- 기존 데이터 이관 없음(계정 1개).

## 구성
1. `src/lib/signup-policy.ts`: `isEmailAllowed(email, allowedEnv)` 순수 함수 (단위 테스트 대상). `signup` 액션이 사용.
2. 조회 화면/라우트(환자 목록·상세·수정, 계획, 기록, 인쇄, ics, 설정, fess-checklist, 재사용 lib): 조회 조건에 소유자 조건 추가, 없으면 notFound.
3. Server Action(patients, op-plans, op-records, patient-plan): 변경 전 소유 확인. `deleteMany`/`updateMany`에 where 조건 포함.
4. 오류 시 존재 여부를 노출하지 않도록 "없음"과 동일하게 처리.

## 테스트
- `isEmailAllowed` 단위 테스트(빈 값, 공백, 대소문자, 미포함).
- 모든 `prisma.(patient|opPlan|opRecord)` 호출을 grep으로 목록화해 소유 조건 누락 점검.
- `tsc`, `next build`로 검증.
