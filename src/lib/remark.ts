// 차트(EMR) remark 칸에 그대로 붙여넣을 수 있게 CC(주호소) · 수술명 · 수술 후
// 특이사항을 한 덩어리로 묶는다. 비어 있는 항목은 줄째로 뺀다 — "CC : " 처럼
// 빈 칸이 남아 있으면 붙여넣은 뒤 매번 지워야 해서.
export function buildRemarkText({
  chiefComplaint,
  surgeryDate,
  procedureName,
  postOpRemark,
}: {
  chiefComplaint?: string;
  surgeryDate?: string;
  procedureName?: string;
  postOpRemark?: string;
}): string {
  const lines: string[] = [];
  const cc = chiefComplaint?.trim();
  if (cc) lines.push(`CC : ${cc}`);
  const op = [surgeryDate?.trim(), procedureName?.trim()].filter(Boolean).join(" ");
  if (op) lines.push(`Op : ${op}`);
  const remark = postOpRemark?.trim();
  if (remark) {
    // 여러 줄로 적은 특이사항은 머리말 다음 줄부터 그대로 이어 붙인다.
    lines.push(remark.includes("\n") ? `수술 후 특이사항 :\n${remark}` : `수술 후 특이사항 : ${remark}`);
  }
  return lines.join("\n");
}
