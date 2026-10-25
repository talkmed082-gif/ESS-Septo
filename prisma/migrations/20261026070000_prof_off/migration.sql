-- 교수님 부재(휴가·출장·반일 휴가) — 사유는 안 남김
ALTER TABLE "ProfSchedule" ADD COLUMN "off" TEXT;
