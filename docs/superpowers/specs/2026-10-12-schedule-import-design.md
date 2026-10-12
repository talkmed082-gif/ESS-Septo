# 수술 스케줄 엑셀 가져오기 설계

## 목표
매주 메일로 받는 "ENT 수술 스케줄" 엑셀(`ENT수술_YYYY_M월 N주차.xlsx`)을 업로드하면, 로그인한 계정 이름(`User.name`)과
`교수님` 칸이 같은 행만 골라 새 수술 케이스(Patient + OpPlan, PLANNED)로 만든다.

## 결정 사항 (사용자 승인)
- 사이트에 `/import` 화면 추가: 업로드 → 미리보기(체크박스) → 체크한 행만 생성. 파일은 저장하지 않는다.
- 대상 행: `교수님` == `User.name` (공백 제거 후 완전 일치). 다른 교수님 행은 서버에서 버리고 응답에도 싣지 않는다.
- ESS/Septo 계열이 아닌 수술(TSA, Endo T-P 등)은 미리보기에 회색 "지원 안 됨"으로만 표시, 생성 불가.
- **고정 규칙: 엑셀 `Septoturbinoplasty` = Septoplasty + Inferior turbinoplasty 양측.** 괄호 표기와 무관. 사이트에서도
  수술명이 "Septoturbinoplasty"로 보여야 한다(아래 사이트 수정 포함).
- Gmail 자동 수집은 이번 범위 밖(수동 다운로드 후 업로드).

## 엑셀 형식 (2026 10월 3주차 기준)
- 헤더 행: `날짜 | 요일 | Room | 순번 | 교수님 | assist | 등록번호 | 성명 | 성별 | 나이 | 진단 | 수술 | 마취 | 예상소요시간 | (비고)`.
  헤더 행은 위치가 아니라 `교수님`·`수술` 셀이 있는 행으로 찾고, 열도 헤더 텍스트(trim)로 찾는다.
- 날짜는 그날 첫 행에만 있음 → 아래로 채워 내린다(forward-fill). 시트 이름("7월7주")은 실제 주차와 달라 쓰지 않는다.
- 수술 칸: `;`로 술식 구분, `[R]/[L]/[B]` = 우/좌/양측.

## 매핑 (순수 함수 `mapScheduleProcedure(text)`)
술식 토큰을 대소문자 무시로 판별:
- ESS 계열: `ESS`, `FESS`
- Septo 계열: `Septoplasty`, `Septoturbinoplasty`
- ITR: `ITR[side]` → Inferior turbinoplasty 해당 측

| 엑셀 | 수술 종류 | planData |
|---|---|---|
| ESS만 | ESS | 기본값 |
| Septoplasty만 | SEPTOPLASTY | `turb_inferior_right/left` = false (기본값이 true라 명시적으로 끔) |
| Septoturbinoplasty | SEPTOPLASTY | Inferior 양측 true |
| ESS + Septo 계열 | COMBO | Septoturbinoplasty면 Inferior 양측 true |
| + ITR[R/L/B] | (위 종류 유지) | 해당 측 Inferior true |
| ESS·Septo 둘 다 없음 | 지원 안 됨 | — |

ESS 측(`[L]` 등)과 sinus 세부 단계는 채우지 않는다(엑셀에 정보 부족). planData는 해당 수술 종류의 필드 기본값 위에
위 값만 덮어쓴다.

## 그 밖의 값
- `plannedDate` ← 날짜, `diagnosis` ← 진단.
- Patient: `chartNo` ← 등록번호, `name` ← 성명, `sex` ← 성별(M/F), `age` ← 나이(`41Y`→41, `6Y1M`→6, `16M`→0).
- `planNote` ← `원본 수술 문자열 / Room·순번 / assist / 마취 / 소요시간 / 비고` 한 줄씩.

## 중복 방지
- 같은 계정에 같은 `chartNo` 환자가 있으면 재사용.
- 같은 환자 + 같은 날짜 + 같은 수술 종류 OpPlan이 이미 있으면 미리보기에 "이미 있음", 생성 시 건너뜀.

## 사이트 수정: COMBO 수술명
`buildProcedureName`의 COMBO 분기에서 Inferior 양측이면 `"Septoturbinoplasty + {ESS…}"`로 쓰고 전역 접미사에서
"[B] inferior turbinoplasty"를 뺀다(단독 SEPTOPLASTY의 `septoplastyProcedureName` 규칙과 일치). 수술명은 매번 계산되므로
기존 COMBO 계획 표시도 바뀐다. 이미 저장된 기록지의 `procedureName`은 그대로.

## 구성
1. 의존성: `exceljs` 추가(xlsx 파싱; 현재 프로젝트에 엑셀 파서 없음).
2. `src/lib/schedule-import.ts`: `parseScheduleRows(buffer)`, `mapScheduleProcedure(text)`, `parseAge(text)` — 순수 로직.
3. `src/app/actions/schedule-import.ts`: `previewSchedule(formData)`(세션 필요, 내 행만 + 중복 표시), `importSchedule(rows)`(체크된 행 생성, 트랜잭션).
4. `src/app/(app)/import/page.tsx` + 클라이언트 폼, 내비게이션에 "엑셀 가져오기" 링크.
5. `src/lib/op-note-generator.ts`: COMBO 수술명 수정.

## 개인정보
- 엑셀 원본·다른 교수님 행은 저장·로그·응답 어디에도 남기지 않는다. 로그는 건수만. 외부 API(Jev 등) 호출 없음.
- 테스트 픽스처는 실제 파일이 아니라 같은 구조의 **가상 데이터**로 코드에서 생성한다(실명·등록번호 커밋 금지).

## 완료 기준
- 단위 테스트 통과:
  - 매핑 표 전 항목, 특히 `Septoturbinoplasty` → SEPTOPLASTY + Inferior 양측, `Septoplasty` → Inferior 해제.
  - 수술명: 단독 Inferior 양측 → "Septoturbinoplasty", COMBO Inferior 양측 → "Septoturbinoplasty + ESS…".
  - 파싱: 날짜 forward-fill, 헤더로 열 찾기, 나이 변환, 다른 교수님 행 제외.
- 기존 테스트 전부 통과. 단, `op-note-generator.test.ts:229` "병행은 Septoplasty + ESS 이름에 turbinoplasty 접미사를
  붙인다"는 바로 이 옛 동작을 고정하고 있어 기대값을
  `"Septoplasty + Both ESS(Ethmoid, Maxillary) + Both Turbinoplasty"` →
  `"Septoturbinoplasty + Both ESS(Ethmoid, Maxillary)"`로 바꿔야 한다(사용자 승인 필요).
- 로컬 dev 서버에서 실제 10월 3주차 파일 업로드 → 정일구 1건(10/16, ESS, CRS[B]) 미리보기 → 생성 → 환자 목록·계획 화면 확인,
  같은 파일 재업로드 시 "이미 있음". 브라우저 콘솔 에러 없음.
