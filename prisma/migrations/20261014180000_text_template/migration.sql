-- CreateTable
CREATE TABLE "TextTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextTemplate_createdById_idx" ON "TextTemplate"("createdById");

-- AddForeignKey
ALTER TABLE "TextTemplate" ADD CONSTRAINT "TextTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 사용자 요청(2026-10-14): 정일구 계정의 첫 템플릿. 이름이 같은 계정이 없으면 아무것도 넣지 않는다.
INSERT INTO "TextTemplate" ("id", "title", "body", "createdById", "createdAt", "updatedAt")
SELECT 'tmpl_' || md5(random()::text || "id"), '수술 전 특이사항 및 브리핑', $body$[수술 전 특이사항 및 브리핑]

수술명/부위: Septoturbinoplasty, Both ESS

핵심 리스크: 수술 범위 추가 가능성, 수술 범위 축소 가능성, 출혈 가능성 높음.

환자/보호자 특이사항: 

동의서 범위: 수술동의서, 마취동의서

진행 요청: 상기 내용 바탕으로 동의서 설명 부탁드립니다.$body$, "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" WHERE "name" = '정일구';
