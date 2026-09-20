import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildPlanTable, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { PrintButton } from "@/components/print-button";

// 수술방에서 내시경 모니터 앞에 붙여두고 손으로 체크하는 용도의 FESS 시행
// 부위 체크리스트. A4 한 장에 4장씩 나온다. 환자 목록에서 ?plans=id1,id2,...
// 로 계획 id를 넘기면 그 계획들의 실제 체크 상태로 채워서 인쇄하고(부족한
// 칸은 빈 양식), 아무것도 안 넘기면 전부 빈 양식으로 미리 뽑아둘 수 있다.
const FESS_ONLY_ROW_LABELS = ["중비갑개 축소술", "하비갑개 축소술"];
const BLANK_ROWS = [
  "Uncinectomy",
  "MMA (Middle meatal antrostomy)",
  "Ant. ethmoidectomy",
  "Post. ethmoidectomy",
  "Sphenoidotomy",
  "Frontal sinusotomy",
  ...FESS_ONLY_ROW_LABELS,
];

interface CardRow {
  label: string;
  right: boolean;
  left: boolean;
}

interface CardData {
  patientName: string;
  date: string | null;
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

// 손으로 밑줄만 그으면 되는 빈 줄 여러 개 — flex-1로 남는 세로 공간을
// 줄 사이에 고르게 나눠 채워서 카드 높이가 달라져도 항상 꽉 차 보인다.
function BlankLines({ count }: { count: number }) {
  return (
    <div className="flex flex-1 flex-col justify-between">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="border-b border-slate-300" />
      ))}
    </div>
  );
}

function ChecklistCard({ data }: { data?: CardData }) {
  const rows: CardRow[] = data?.rows ?? BLANK_ROWS.map((label) => ({ label, right: false, left: false }));
  const box = (checked: boolean) => (checked ? "☑" : "☐");

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 space-y-1.5 text-xs">
        <div className="flex gap-1">
          <span className="shrink-0 text-slate-500">환자명:</span>
          <span className="flex-1 border-b border-slate-400 font-medium">
            {data?.patientName ?? " "}
          </span>
          <span className="shrink-0 text-slate-500">날짜:</span>
          <span className="flex-1 border-b border-slate-400 font-medium">{data?.date ?? " "}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-slate-500">{box(data?.revision === true)} Revision case</span>
          <span className="ml-2 shrink-0 text-slate-500">수술명:</span>
          <span className="flex-1 border-b border-slate-400 font-medium">
            {data?.procedureName ?? " "}
          </span>
        </div>
      </div>
      {/* 1개 인쇄용 보기(PlanTableView)와 순서를 맞춘다 — 비강 소견이 Op
          Plan(시행 부위 표)보다 먼저 나온다. */}
      <div className="mb-2 flex flex-1 flex-col">
        <span className="mb-1 text-xs font-medium text-slate-600">비강 소견</span>
        {data ? (
          <p className="text-[11px] whitespace-pre-wrap text-slate-700">{data.findings || "-"}</p>
        ) : (
          <BlankLines count={4} />
        )}
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-slate-400 bg-slate-50 px-1.5 py-1.5 text-left font-medium">
              시행 부위
            </th>
            <th className="w-12 border border-slate-400 bg-slate-50 px-1.5 py-1.5 font-medium">
              우측
            </th>
            <th className="w-12 border border-slate-400 bg-slate-50 px-1.5 py-1.5 font-medium">
              좌측
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border border-slate-400 px-1.5 py-1.5">{row.label}</td>
              <td className="border border-slate-400 text-center text-sm">{box(row.right)}</td>
              <td className="border border-slate-400 text-center text-sm">{box(row.left)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const { plans } = await searchParams;
  const planIds = (typeof plans === "string" ? plans.split(",") : []).filter(Boolean);

  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  let cardsData: CardData[] = [];
  if (planIds.length > 0) {
    const opPlans = await prisma.opPlan.findMany({
      where: { id: { in: planIds } },
      include: { patient: true, surgeryType: true },
    });
    const byId = new Map(opPlans.map((p) => [p.id, p]));
    cardsData = planIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((plan) => {
        const values = parseFieldValues(plan.planData);
        const code = plan.surgeryType.code;
        const table = isBuiltInSurgeryCode(code) ? buildPlanTable(code, values, nameStyle) : null;
        const rows: CardRow[] = [
          ...(table?.sideMatrix?.rows.map((r) => ({ label: r.label, right: r.right, left: r.left })) ?? []),
          {
            label: "중비갑개 축소술",
            right: values.turb_middle_right === true,
            left: values.turb_middle_left === true,
          },
          {
            label: "하비갑개 축소술",
            right: values.turb_inferior_right === true,
            left: values.turb_inferior_left === true,
          },
        ];
        return {
          patientName: plan.patient.name,
          date: safeDateStr(plan.plannedDate),
          procedureName: table?.procedureName ?? plan.surgeryType.name,
          revision: values.f_revision === true,
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
    <div className="mx-auto w-full max-w-3xl bg-white p-3 text-slate-900 sm:p-8 print:max-w-none print:p-0">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-2 bg-white py-2 print:hidden">
        <Link href="/patients" className="text-sm text-slate-500 hover:underline">
          ← 목록으로 돌아가기
        </Link>
        <PrintButton />
      </div>
      <p className="mb-3 text-xs text-slate-500 print:hidden">
        {cardsData.length > 0
          ? "선택한 환자들의 최신 수술 계획으로 채워서 인쇄합니다. 4명 단위로 한 페이지씩 나뉘고, 남는 칸은 빈 양식입니다."
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
  );
}
