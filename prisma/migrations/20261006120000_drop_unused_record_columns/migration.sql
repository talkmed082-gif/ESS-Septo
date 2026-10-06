-- 기록지 화면에서 한 번도 입력받지 않아 항상 비어 있던 칸 — 수술 후 특이사항은
-- OpPlan.postOpRemark 로 받는다.
ALTER TABLE "OpRecord" DROP COLUMN "complication",
DROP COLUMN "postOpPlan";
