import { redirect } from "next/navigation";

// 기록지는 수술 계획의 "수술 후" 화면(기록지 초안) 하나로 합쳤다(사용자 2026-10-16) —
// 예전 "정식 기록지 작성" 링크·북마크로 들어와도 그 화면으로 보낸다.
export default async function NewOpRecordPage({ params }: PageProps<"/plans/[id]/record">) {
  const { id } = await params;
  redirect(`/plans/${id}?view=post`);
}
