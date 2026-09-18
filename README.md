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
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)
- jose 기반 stateless 세션 인증 (httpOnly 쿠키)
- Tailwind CSS 4

## 시작하기

```bash
npm install
cp .env.example .env   # DATABASE_URL(Postgres 연결 문자열), SESSION_SECRET(openssl rand -base64 32) 채워주세요
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

PostgreSQL을 사용합니다. 로컬 개발 시 `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`
같은 방식으로 로컬 Postgres를 띄우거나, Vercel Postgres/Neon/Supabase 등 클라우드 DB의 연결
문자열을 `DATABASE_URL`에 넣어 사용하면 됩니다.

## Vercel 배포

1. 이 저장소를 GitHub에 연결한 Vercel 프로젝트를 만듭니다.
2. Vercel 대시보드의 Storage 탭에서 Postgres(Neon)를 추가합니다 — 프로젝트에 자동으로
   `DATABASE_URL`(혹은 `POSTGRES_PRISMA_URL`) 환경 변수가 연결됩니다. 서버리스 환경에서는
   반드시 커넥션 풀링이 적용된 URL을 사용하세요(Neon의 `-pooler` 호스트).
3. `SESSION_SECRET` 환경 변수를 Vercel 프로젝트 설정에 추가합니다 (`openssl rand -base64 32`).
4. 빌드 시 `prisma migrate deploy`가 자동 실행되도록 `package.json`의 `build` 스크립트가
   구성되어 있습니다. 최초 배포 후 `npx prisma db seed`를 로컬에서 프로덕션 `DATABASE_URL`로
   한 번 실행해 기본 수술 종류(ESS/비중격교정술)를 넣어주세요.
