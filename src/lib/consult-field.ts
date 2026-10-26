import { askJev, choice } from "@/lib/jev";

// 타과의뢰가 내 분야(코)인지 — 사용자는 코 담당. 어지럼증 의뢰가 잘못 온 일(2026-10-26)로 "잘못 오는 거 판정" 요청.
// 화면에 참고 표시만 한다(수신의 변경·숨기기 같은 자동 처리 없음).
// 1) 낱말 규칙 — 외부 호출 없음. 2) 규칙으로 못 가르면 Jev(의뢰내용·진단만, 이름·등록번호는 애초에 안 넘김, 긴 숫자 지움). 실패하면 "unknown".
export type ConsultField = "nose" | "ear" | "headneck" | "unknown";
export const FIELD_LABEL: Record<ConsultField, string> = { nose: "코", ear: "귀", headneck: "두경부", unknown: "판단 못 함" };

// 단독 "귀"·"코"는 "귀가"·"코로나" 같은 말에 걸려서 넣지 않는다
const RULES: Record<Exclude<ConsultField, "unknown">, RegExp[]> = {
  ear: [
    /어지럼|어지러|현훈|dizz|vertigo|bppv/i, /이명|tinnitus/i, /난청|청력|hearing/i, /중이염|otitis/i, /고막|이루|외이도|이통|otalgia|otorrh/i,
    /안면\s*마비|facial\s*palsy|bell'?s/i, /메니에르|meniere/i, /전정|vestibul|안진|nystagmus/i, /돌발성/i, /귓|귀\s*(통증|아프|먹|소리|에서|가\s*아)/i,
  ],
  headneck: [
    /갑상선|thyroid/i, /경부\s*(종물|종괴|림프)|neck\s*mass|목\s*(종물|혹|멍울)|림프절|lymph/i, /후두|laryn/i, /성대|vocal|쉰\s*목소리|애성|hoarse/i,
    /연하|삼킴|dysphag/i, /침샘|이하선|악하선|parotid|submandib|salivary/i, /편도|tonsil/i, /인두|pharyn/i, /기관\s*절개|tracheost|기도\s*(확보|폐쇄)|airway/i,
    /구강|oral\s*cavity|혀\b|tongue/i,
  ],
  nose: [
    /비강|nasal|비내/i, /부비동|sinus|축농증|crs\b/i, /비출혈|코피|epistaxis/i, /비중격|septum|septal/i, /비염|rhinit/i, /비용종|polyp/i,
    /후각|olfact|anosmia|hyposmia/i, /코막힘|코\s*막|비폐색|콧물|비루|rhinorr/i, /비골|nasal\s*bone/i, /상악동|사골|접형|전두동|maxillary|ethmoid|sphenoid|frontal\s*sinus/i,
    /csf\s*(leak|비루)|뇌척수액/i,
  ],
};

// 규칙 판정: 걸린 분야가 하나뿐이거나, 가장 많이 걸린 분야가 다음보다 2배 이상이면 그 분야. 아니면 null(Jev로)
export function ruleField(text: string): { field: Exclude<ConsultField, "unknown">; hits: string[] } | null {
  const scored = (Object.keys(RULES) as (keyof typeof RULES)[])
    .map((field) => {
      const hits = RULES[field].map((re) => re.exec(text)?.[0]).filter((h): h is string => !!h);
      return { field, hits };
    })
    .filter((s) => s.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);
  if (scored.length === 0) return null;
  if (scored.length === 1 || scored[0].hits.length >= 2 * scored[1].hits.length) return { field: scored[0].field, hits: scored[0].hits };
  return null;
}

const JEV_MIN_CONFIDENCE = 0.7;

// 의뢰내용·진단으로 분야를 고른다. 이유(fieldReason)는 화면에 그대로 보인다
export async function classifyConsultField(input: { content: string | null; diagnosis: string | null }): Promise<{ field: ConsultField; reason: string }> {
  const text = [input.diagnosis, input.content].filter(Boolean).join("\n").replace(/\d{6,}/g, "");
  if (!text.trim()) return { field: "unknown", reason: "의뢰내용 없음" };
  const rule = ruleField(text);
  if (rule) return { field: rule.field, reason: rule.hits.slice(0, 3).join(", ") };

  const answers = await askJev(
    { 진단: input.diagnosis?.replace(/\d{6,}/g, "") ?? "", 의뢰내용: input.content?.replace(/\d{6,}/g, "") ?? "" },
    {
      field: choice("이 타과의뢰는 이비인후과의 어느 세부 분야 진료가 필요한가?", {
        nose: "코: 비강·부비동·비출혈·비중격·비염·비용종·후각",
        ear: "귀: 어지럼증·청력·이명·중이염·고막·안면마비",
        headneck: "두경부: 갑상선·경부 종물·후두·음성·연하·침샘·편도·인두·기도",
        unknown: "여러 분야에 걸치거나 정보가 부족해 고를 수 없음",
      }),
    },
  );
  const a = answers?.field;
  if (!a || a.confidence < JEV_MIN_CONFIDENCE) return { field: "unknown", reason: answers ? "AI도 확실하지 않음" : "판단 못 함" };
  return { field: a.choice as ConsultField, reason: `AI 판단(${Math.round(a.confidence * 100)}%)` };
}
