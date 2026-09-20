// patient-list-table.tsx("use client")와 page.tsx(서버 컴포넌트) 양쪽에서
// 같이 써야 하는 타입/순수 함수는 별도의 일반 모듈로 뺀다 — "use client"
// 파일의 export를 서버 컴포넌트에서 직접 호출하면(컴포넌트가 아닌 일반
// 함수라도) 클라이언트 레퍼런스로 취급되어 서버에서 호출 시 런타임 에러가
// 난다. 실제로 patients/page.tsx의 정렬 로직에서 이 문제로 /patients
// 전체가 죽었었다.
export interface PatientRow {
  id: string;
  name: string;
  chartNo: string | null;
  sex: string | null;
  age: number | null;
  surgeryDate: string | null;
  surgeryPlanId: string | null;
  procedureName: string | null;
  recordId: string | null;
  planDone: boolean;
}

// 기록지가 이미 있으면 그 자체로 완료고, 없으면 "완료" 체크(며칠 뒤에
// 몰아서 기록지를 쓰는 경우가 많아 수동으로 표시)를 따른다.
export function isPlanDone(p: PatientRow): boolean {
  return Boolean(p.recordId) || p.planDone;
}
