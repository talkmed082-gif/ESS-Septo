// 진료 어시스트 [약물치료]·[오더] 버튼에 띄울 YES 약속처방(2026-10-26 사용자 "비염약 세트오더는 YES에서 가져오고").
// 올려 둔 약속처방 트리(EmrSetOrder)에서 코 외래 폴더만 골라 성인/소아 · 약/그 밖의 오더로 나눈다
const ADULT_FOLDERS = [/비과 _ 외래진료$/, /비과 외래 오더$/];
const CHILD_FOLDERS = [/소아 외래 › 소아 비과$/];
const DRUG = /약|\bPO\b|스프레이|Rhinitis|\bAR\b|CRS|Polyp|항생제|후각 이상|미각|감기|비강건조/i;
const TEST = /검사|lab\b|culture|생검|biopsy/i; // 이름에 검사가 있으면 약 묶음이 아니라 오더(예: "소아 AR 검사")

export type SetItem = { key: string; name: string; path: string; ownerEmpNo: string };
export type SetGroups = { adultRx: SetItem[]; adultOrders: SetItem[]; childRx: SetItem[]; childOrders: SetItem[] };

export function groupClinicSets(items: SetItem[]): SetGroups {
  const g: SetGroups = { adultRx: [], adultOrders: [], childRx: [], childOrders: [] };
  for (const it of items) {
    const adult = ADULT_FOLDERS.some((r) => r.test(it.path));
    const child = CHILD_FOLDERS.some((r) => r.test(it.path)) || (adult && /소아/.test(it.name));
    if (!adult && !child) continue;
    const drug = DRUG.test(it.name) && !TEST.test(it.name);
    if (child) (drug ? g.childRx : g.childOrders).push(it);
    else (drug ? g.adultRx : g.adultOrders).push(it);
  }
  return g;
}
