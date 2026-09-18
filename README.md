# Op Plan & 수술기록지

이비인후과(ESS, 비중격교정술 등) 수술 계획을 작성하고, 수술 후 수술기록지를 작성/출력하기 위한 웹 애플리케이션입니다.

## 주요 기능

- 로그인/회원가입 (계정별 데이터 관리)
- 환자 등록/검색/조회
- 환자별 수술 계획(Op Plan) 작성 — 수술 종류에 따라 동적으로 입력 항목이 바뀝니다.
- 수술 계획을 바탕으로 수술기록지(Op Record) 작성 및 인쇄용 보기(PDF 저장 가능)
- 수술 종류 관리 — 기본 제공되는 ESS(부비동내시경수술), 비중격교정술 외에 다른 이비인후과 수술도
  코드 수정 없이 직접 추가할 수 있습니다 (수술별 체크리스트/입력 항목을 자유롭게 정의).

## 기술 스택

- Next.js 16 (App Router, Server Actions)
- Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`)
- jose 기반 stateless 세션 인증 (httpOnly 쿠키)
- Tailwind CSS 4

## 시작하기

```bash
npm install
cp .env.example .env   # SESSION_SECRET 값을 openssl rand -base64 32 로 생성해서 채워주세요
npx prisma migrate deploy
npx prisma db seed     # ESS / 비중격교정술 기본 수술 종류 생성
npm run dev
```

http://localhost:3000 접속 후 회원가입으로 계정을 만들어 사용하시면 됩니다.

## 수술 종류(SurgeryType) 커스텀

`/surgery-types` 페이지에서 코드(영문 대문자), 이름, 입력 항목(체크박스/텍스트/선택/숫자 등)을
자유롭게 추가할 수 있습니다. 추가된 수술 종류는 수술 계획 작성 시 바로 선택할 수 있고,
계획에서 입력한 값은 기록지 작성 시 기본값으로 불러와집니다.

## 데이터베이스

기본값은 로컬 SQLite(`dev.db`)입니다. 운영 환경에서는 `DATABASE_URL`을 원하는 데이터베이스로
바꾸고, `@prisma/adapter-better-sqlite3` 대신 해당 DB용 Prisma 드라이버 어댑터로 교체하면 됩니다.
