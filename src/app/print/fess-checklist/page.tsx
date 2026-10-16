import { SubPageNav } from "@/components/sub-page-nav";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildPlanTable, hasAnyRevision, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { PrintButton } from "@/components/print-button";
import { AppNavBar } from "@/components/app-nav-bar";
import { CheckBox, DataCell } from "@/components/check-cell";

// 수술방에서 내시경 모니터 앞에 붙여두고 손으로 체크하는 용도의 FESS 시행
// 부위 체크리스트. A4 한 장에 4장씩 나온다. 환자 목록에서 ?plans=id1,id2,...
// 로 계획 id를 넘기면 그 계획들의 실제 체크 상태로 채워서 인쇄하고(부족한
// 칸은 빈 양식), 아무것도 안 넘기면 전부 빈 양식으로 미리 뽑아둘 수 있다.
// Turbinoplasty는 수술명에 쓴다. Uncinectomy는 ESS면 늘 하는 것이라 빈 양식에서도 뺀다(채운 칸에도 없음).
const BLANK_ROWS = [
  "MMA (Middle meatal antrostomy)",
  "Ant. ethmoidectomy",
  "Post. ethmoidectomy",
  "Sphenoidotomy",
  "Frontal sinusotomy",
];

interface CardRow {
  label: string;
  right: boolean;
  left: boolean;
}

// 빈 양식의 비강 소견 — 손으로 다 쓰기엔 너무 많아서 항목을 미리 적어 두고 체크만 한다(사용자 2026-10-16).
// 맨 위 기본 4개(DSN·CHR·Concha bullosa·Polyp), 그 아래 Pre-op anatomy를 C/L/O/S/E 한 줄씩(S만 두 줄).
// 인쇄 칸이 좁아 화면 입력 항목 중 핵심만 추린다(사용자 지정) — Asym. Keros는 Low skull base를
// 한쪽만 체크하면 되고, S는 함기화 한 줄 + 경동맥/시신경 결손 한 줄.
const BLANK_BASICS = ["DSN", "CHR", "Concha bullosa", "Polyp"];
const BLANK_CLOSE: { letter: string; items: { label: string; options?: string[] }[] }[] = [
  { letter: "C", items: [{ label: "Low skull base" }, { label: "SB 결손" }] },
  { letter: "L", items: [{ label: "LP 결손" }, { label: "Haller cell" }] },
  { letter: "O", items: [{ label: "Onodi cell" }, { label: "Onodi 내 시신경" }] },
  { letter: "S", items: [{ label: "함기화", options: ["Conchal", "Presellar", "Sellar"] }, { label: "ICA/시신경 결손" }] },
  { letter: "E", items: [{ label: "AEA 낮게 주행" }, { label: "Supraorbital" }] },
];

function BlankItem({ label, options = ["R", "L"], wide }: { label: string; options?: string[]; wide?: boolean }) {
  return (
    <div className={`flex items-center gap-1 ${wide ? "col-span-2" : ""}`}>
      <span className="flex-1 truncate">{label}</span>
      {options.map((o) => (
        <span key={o} className="flex shrink-0 items-center gap-0.5 text-[11px] text-slate-600">
          <CheckBox />
          {o}
        </span>
      ))}
    </div>
  );
}

function BlankFindings() {
  return (
    <div className="space-y-1 text-[12px]">
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-b border-slate-300 pb-1">
        {BLANK_BASICS.map((label) => (
          <BlankItem key={label} label={label} />
        ))}
      </div>
      {BLANK_CLOSE.map((g) => (
        <div key={g.letter} className="flex gap-1.5 border-b border-slate-200 pb-0.5">
          <span className="w-4 shrink-0 text-sm leading-5 font-bold">{g.letter}</span>
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-0.5">
            {g.items.map((f) => (
              <BlankItem key={f.label} label={f.label} options={f.options} wide={!!f.options} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface CardData {
  patientName: string;
  date: string | null;
  cc: string;
  // 병행 수술 순서(있을 때만). 동반 술식 줄은 뺐다 — 수술명에 쓴다(사용자 2026-10-16)
  order: string;
  procedureName: string;
  revision: boolean;
  findings: string;
  rows: CardRow[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ChecklistCard({ data }: { data?: CardData }) {
  const rows: CardRow[] = data?.rows ?? BLANK_ROWS.map((label) => ({ label, right: false, left: false }));

  return (
    <div className="flex h-full flex-col overflow-hidden p-3">
      <div className="mb-2 space-y-1.5 text-sm">
        <div className="flex gap-1">
          <span className="shrink-0 text-slate-500">환자명:</span>
          <span className="flex-1 border-b border-slate-400 font-medium">
            {data?.patientName ?? " "}
          </span>
          <span className="shrink-0 text-slate-500">날짜:</span>
          <span className="flex-1 border-b border-slate-400 font-medium">{data?.date ?? " "}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Revision case는 표 밖의 항목이라 표 칸과 달리 체크박스 형태를
              그대로 유지한다 (값이 채워진 카드도 동일). */}
          <CheckBox checked={data?.revision === true} />
          <span className="shrink-0 text-slate-500">Revision case</span>
          {/* CC는 짧아서 Revision 옆에, 수술명은 길어서 한 줄 전체에(사용자 2026-10-16) */}
          <span className="ml-2 shrink-0 text-slate-500">CC:</span>
          <span className="flex-1 border-b border-slate-400 font-medium">{data?.cc || " "}</span>
        </div>
        <div className="flex gap-1">
          <span className="shrink-0 text-slate-500">수술명:</span>
          <span className="flex-1 border-b border-slate-400 font-semibold">
            {data?.procedureName ?? " "}
          </span>
        </div>
        {data?.order && (
          <div className="flex gap-1">
            <span className="shrink-0 text-slate-500">순서:</span>
            <span className="flex-1 border-b border-slate-400 font-medium">{data.order}</span>
          </div>
        )}
      </div>
      {/* 1개 인쇄용 보기(PlanTableView)와 순서를 맞춘다 — 비강 소견이 Op
          Plan(시행 부위 표)보다 먼저 나온다. 값이 채워진 카드는 소견
          길이가 제각각이라 flex-1로 늘리면 표 시작 위치가 카드마다
          들쭉날쭉해지므로, 빈 양식일 때만 손글씨 줄을 늘려서 채운다. */}
      <div className="mb-2 flex flex-col">
        <span className="mb-1 text-sm font-semibold text-slate-700">비강 소견</span>
        {data ? (
          // 소견이 많으면 한 줄씩 쓸 때 표가 잘려서(사용자 2026-10-16) " · "로 이어 쓴다
          <p className="text-[12px] leading-snug text-slate-900">
            {data.findings ? data.findings.split("\n").join(" · ") : "-"}
          </p>
        ) : (
          <BlankFindings />
        )}
      </div>
      {rows.length > 0 && (
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border border-slate-400 bg-slate-50 px-1.5 py-1 text-left font-medium">
              시행 부위
            </th>
            <th className="w-12 border border-slate-400 bg-slate-50 px-1.5 py-1 font-medium">
              우측
            </th>
            <th className="w-12 border border-slate-400 bg-slate-50 px-1.5 py-1 font-medium">
              좌측
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border border-slate-400 px-1.5 py-0.5">{row.label}</td>
              {data ? (
                <>
                  <DataCell checked={row.right} />
                  <DataCell checked={row.left} />
                </>
              ) : (
                <>
                  <td className="border border-slate-400 text-center">
                    <CheckBox />
                  </td>
                  <td className="border border-slate-400 text-center">
                    <CheckBox />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {/* 비고 한 줄은 손으로 쓰는 빈칸(사용자 2026-10-16 — 계획 메모를 자동으로 넣으면 너무 길었다) */}
      <div className="mt-auto flex gap-1 pt-2 text-sm">
        <span className="shrink-0 text-slate-500">비고:</span>
        <span className="flex-1 border-b border-slate-400"> </span>
      </div>
    </div>
  );
}

function ChecklistPage({ cards }: { cards: (CardData | undefined)[] }) {
  const borderClasses = [
    "border-r border-b border-dashed border-slate-400",
    "border-b border-dashed border-slate-400",
    "border-r border-dashed border-slate-400",
    "",
  ];
  return (
    <div className="grid grid-cols-2 grid-rows-2 print:h-[277mm]">
      {cards.map((data, i) => (
        <div key={i} className={borderClasses[i]}>
          <ChecklistCard data={data} />
        </div>
      ))}
    </div>
  );
}

export default async function FessChecklistPrintPage({
  searchParams,
}: PageProps<"/print/fess-checklist">) {
  const user = await getCurrentUser();
  const { plans, date } = await searchParams;
  let planIds = (typeof plans === "string" ? plans.split(",") : []).filter(Boolean);
  // ?date=YYYY-MM-DD — 그날 수술 계획 전체를 한 번에(사용자 2026-10-16). 등록한 순서대로.
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  if (day) {
    const start = new Date(day);
    const sameDay = await prisma.opPlan.findMany({
      where: { createdById: user.id, plannedDate: { gte: start, lt: new Date(start.getTime() + 86400000) } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    planIds = sameDay.map((p) => p.id);
  }

  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  let cardsData: CardData[] = [];
  if (planIds.length > 0) {
    const opPlans = await prisma.opPlan.findMany({
      where: { id: { in: planIds }, createdById: user.id },
      include: { patient: { select: { name: true } }, surgeryType: { select: { code: true, name: true } } },
    });
    const byId = new Map(opPlans.map((p) => [p.id, p]));
    cardsData = planIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((plan) => {
        const values = parseFieldValues(plan.planData);
        const code = plan.surgeryType.code;
        const table = isBuiltInSurgeryCode(code) ? buildPlanTable(code, values, nameStyle) : null;
        const rows: CardRow[] =
          table?.sideMatrix?.rows.map((r) => ({ label: r.label, right: r.right, left: r.left })) ?? [];
        const rowValue = (label: string) => table?.keyValueRows.find((r) => r.label === label)?.value ?? "";
        return {
          patientName: plan.patient.name,
          date: safeDateStr(plan.plannedDate),
          cc: plan.chiefComplaint ?? "",
          order: rowValue("시행 순서"),

          procedureName: table?.procedureName ?? plan.surgeryType.name,
          revision: hasAnyRevision(values),
          findings: table?.findings ?? "",
          rows,
        };
      });
  }

  // 4개씩 나눠서 페이지를 구성하고, 데이터가 있으면 마지막 페이지의 남는
  // 칸만 빈 양식으로 채운다. 데이터가 아예 없으면 빈 양식 한 페이지만 보여준다.
  const pages: (CardData | undefined)[][] =
    cardsData.length > 0
      ? chunk(cardsData, 4).map((page) => {
          const padded: (CardData | undefined)[] = [...page];
          while (padded.length < 4) padded.push(undefined);
          return padded;
        })
      : [[undefined, undefined, undefined, undefined]];

  return (
    <div>
      <AppNavBar />
      <div className="mx-auto w-full max-w-3xl bg-white px-3 pt-4 pb-3 text-slate-900 sm:px-8 sm:pt-6 sm:pb-8 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          {/* 계획 화면의 "계획 인쇄"로 한 명만 넘어오면 그 계획 화면 링크도 둔다 */}
          <SubPageNav links={planIds.length === 1 ? [{ href: `/plans/${planIds[0]}`, label: "수술 계획 화면" }] : []} />
          <PrintButton />
        </div>
        <p className="mb-3 text-xs text-slate-500 print:hidden">
          {cardsData.length > 0
            ? `${day ? `${day} 수술 ${cardsData.length}명의` : "선택한 환자들의"} 최신 수술 계획으로 채워서 인쇄합니다. 4명 단위로 한 페이지씩 나뉘고, 남는 칸은 빈 양식입니다.`
            : "환자 데이터와 무관한 빈 양식입니다. 미리 여러 장 인쇄해두고 수술방에서 케이스마다 한 장씩 손으로 체크해서 쓰면 됩니다."}{" "}
          가운데 점선을 따라 위아래·좌우로 한 번씩 자르면 4장으로 나뉩니다. (인쇄 대화상자의
          &ldquo;설정 더보기&rdquo;에서 &ldquo;머리글과 바닥글&rdquo;을 꺼두면 날짜/URL 같은
          여백이 더 줄어듭니다.)
        </p>
        {pages.map((cards, i) => (
          <div key={i} className={i < pages.length - 1 ? "print:break-after-page" : ""}>
            <ChecklistPage cards={cards} />
          </div>
        ))}
      </div>
    </div>
  );
}
