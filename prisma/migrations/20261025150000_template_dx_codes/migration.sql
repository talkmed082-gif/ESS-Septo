-- AlterTable
ALTER TABLE "OutpatientTemplate" ADD COLUMN     "dxCodes" TEXT NOT NULL DEFAULT '';

-- 이미 있는 템플릿에 초안 진단 코드(이름이 같고 아직 비어 있는 것만, 사용자 확인 2026-10-25)
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J342,J343' WHERE "title" = '코막힘(비중격·비갑개)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J329' WHERE "title" = '만성 부비동염' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J304' WHERE "title" = '알레르기 비염' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'R438' WHERE "title" = '후각저하' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'R040' WHERE "title" = '코피' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'G4730' WHERE "title" = '코골이·수면무호흡' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'D140' WHERE "title" = '비강·부비동 종물' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J342,J329' WHERE "title" = '수술 후 추적(ESS·비중격)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J312' WHERE "title" = '인후두 이물감·후비루' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J329' WHERE "title" = '부비동염(진단 후 의뢰)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'D140' WHERE "title" = '종물(진단 후 의뢰)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'R51,J329' WHERE "title" = '두통·안면통(진단 후 의뢰)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J353,R065' WHERE "title" = '코골이·입벌림(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J310' WHERE "title" = '콧물·코막힘(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J304' WHERE "title" = '알레르기 비염(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J329' WHERE "title" = '부비동염(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'R040' WHERE "title" = '코피(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'T171' WHERE "title" = '코 이물(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'S0220' WHERE "title" = '코 외상(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'J350' WHERE "title" = '편도염·목 통증(소아)' AND "dxCodes" = '';
UPDATE "OutpatientTemplate" SET "dxCodes" = 'Q381' WHERE "title" = '설소대·발음(소아)' AND "dxCodes" = '';
