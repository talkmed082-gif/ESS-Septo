import { askJev, noul } from "@/lib/jev";
import type { FieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName, generateOpNote, type NameStyle } from "@/lib/op-note-generator";

export interface RecordConsistencyInput {
  surgeryTypeCode: string;
  recordValues: FieldValues;
  nameStyle: NameStyle;
  anesthesiaType?: string;
  procedureName: string;
  procedureDetail: string;
}

// Jev가 이 확률 이상으로 "모순 있음"이라고 볼 때만 경고한다 — 표현만 다른 정상 편집에
// 매번 경고가 뜨면 결국 다들 무시하고 넘기게 되므로 확실한 것만 짚는다.
const WARN_THRESHOLD = 0.8;

const CHECKS = {
  sideMismatch: {
    question:
      "저장할 기록지에 적힌 수술 부위의 좌우(Rt/Lt/Both, 우측/좌측/양측)가 체크 항목 기준 기록지와 어긋나는가?",
    yes: "어느 한 술식이라도 좌우가 기준과 다르게 적혀 있음 (예: 기준은 Rt인데 저장본은 Lt, 기준은 편측인데 저장본은 양측)",
    no: "좌우 표기가 기준과 일치하거나, 좌우와 무관한 표현 차이뿐임",
    warning: "좌우(Rt/Lt/양측) 표기가 체크한 항목과 다를 수 있어요.",
  },
  missingProcedure: {
    question: "체크 항목 기준 기록지에 있는 술식이 저장할 기록지에서 빠져 있는가?",
    yes: "기준에 있는 술식(예: uncinectomy, turbinoplasty, septoplasty, 특정 동 개방)이 저장본에 전혀 언급되지 않음",
    no: "기준의 술식이 표현이나 순서가 달라도 저장본에 모두 들어 있음",
    warning: "체크한 술식 중 기록지 본문에서 빠진 것이 있을 수 있어요.",
  },
  extraProcedure: {
    question: "체크 항목 기준 기록지에 없는 술식이 저장할 기록지에 시행한 것으로 적혀 있는가?",
    yes: "기준에 없는 술식(예: 체크하지 않은 동 개방, 체크하지 않은 turbinoplasty)을 시행했다고 적혀 있음",
    no: "저장본의 추가 내용은 소견·출혈·세부 묘사 등 부연 설명일 뿐, 기준에 없는 술식을 새로 시행했다고 적지는 않음",
    warning: "체크하지 않은 술식이 기록지 본문에 시행한 것으로 적혀 있을 수 있어요.",
  },
} as const;

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * 손으로 고친 수술기록지가 체크한 항목(모식도·체크리스트)과 모순되는지 Jev로 확인해
 * 경고 문구 목록을 돌려준다. 빈 배열이면 경고 없음.
 *
 * 경고만 할 뿐 저장을 막거나 기록을 고치지 않는다. Jev 실패(null)·자동 생성 미지원 수술·
 * 편집하지 않은 기록지는 모두 빈 배열 — 즉 이 검사가 없던 때와 똑같이 저장된다.
 *
 * Jev로는 기록지 글(수술명·본문)과 그 기준 글만 보낸다. 환자 이름·차트번호·나이·메모·
 * 진단명은 이 함수의 입력에 애초에 없다.
 */
export async function checkRecordConsistency(input: RecordConsistencyInput): Promise<string[]> {
  const code = input.surgeryTypeCode;
  if (!isBuiltInSurgeryCode(code)) return [];
  if (!normalize(input.procedureDetail)) return [];

  const note = generateOpNote(code, input.recordValues, "record", input.anesthesiaType);
  const expected = {
    procedureName: buildProcedureName(code, input.recordValues, input.nameStyle),
    procedureDetail: [note.findings, note.procedureDetail].filter(Boolean).join("\n\n"),
  };

  // 자동 생성된 글을 그대로 저장하는 경우 — 모순이 생길 수 없으니 Jev를 부르지 않는다.
  if (
    normalize(input.procedureName) === normalize(expected.procedureName) &&
    normalize(input.procedureDetail) === normalize(expected.procedureDetail)
  ) {
    return [];
  }

  const answers = await askJev(
    {
      기준_기록지: {
        설명: "의사가 체크한 수술 항목으로 자동 생성한 기록지 (정답 기준)",
        수술명: expected.procedureName,
        본문: expected.procedureDetail,
      },
      저장할_기록지: {
        설명: "의사가 손으로 편집한 뒤 저장하려는 기록지",
        수술명: input.procedureName,
        본문: input.procedureDetail,
      },
    },
    Object.fromEntries(
      Object.entries(CHECKS).map(([key, c]) => [key, noul(c.question, { true: c.yes, false: c.no })]),
    ),
  );
  if (!answers) return [];

  return (Object.keys(CHECKS) as (keyof typeof CHECKS)[])
    .filter((key) => (answers[key]?.noul ?? 0) >= WARN_THRESHOLD)
    .map((key) => CHECKS[key].warning);
}
