-- 비중격 편위 "양측(C자형)" 라벨을 "양측(S자형)"으로 바로잡는다 — 양쪽으로 휜 형태는
-- S자형이다. 이미 저장된 계획/기록지 값도 같이 바꿔서 화면 선택값이 비지 않게 한다.
UPDATE "OpPlan" SET "planData" = jsonb_set("planData", '{n_dev_side}', '"양측(S자형)"')
WHERE "planData"->>'n_dev_side' = '양측(C자형)';
UPDATE "OpPlan" SET "actualData" = jsonb_set("actualData", '{n_dev_side}', '"양측(S자형)"')
WHERE "actualData"->>'n_dev_side' = '양측(C자형)';
UPDATE "OpRecord" SET "recordData" = jsonb_set("recordData", '{n_dev_side}', '"양측(S자형)"')
WHERE "recordData"->>'n_dev_side' = '양측(C자형)';
