import * as z from "zod";

const OpRecordSchema = z.object({
  operationDate: z.string().trim().min(1, { error: "수술일을 입력하세요." }),
  surgeonName: z.string().trim().min(1, { error: "집도의를 입력하세요." }),
  anesthesiaType: z.string().trim().optional(),
  procedureName: z.string().trim().optional(),
  findings: z.string().trim().optional(),
  procedureDetail: z.string().trim().optional(),
});

// 화면에 없는 칸은 null로 오는데, 그대로 검사하면 "문자열이 아님"으로 거절된다.
// 실제로 기록지 화면이 소견·과정을 한 칸(procedureDetail)으로 합치면서 findings 칸이
// 사라진 뒤로는 기록지 저장이 화면에 아무 표시 없이 계속 실패했다. 선택 항목은
// 빈 값으로 받는다(필수 항목은 빈 값이면 위 min(1)에서 걸린다).
export function parseRecordFormData(formData: FormData) {
  return OpRecordSchema.safeParse({
    operationDate: formData.get("operationDate") ?? "",
    surgeonName: formData.get("surgeonName") ?? "",
    anesthesiaType: formData.get("anesthesiaType") ?? "",
    procedureName: formData.get("procedureName") ?? "",
    findings: formData.get("findings") ?? "",
    procedureDetail: formData.get("procedureDetail") ?? "",
  });
}

