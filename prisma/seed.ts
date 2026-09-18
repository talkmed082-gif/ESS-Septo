import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { SurgeryFieldDef } from "../src/lib/field-types";

function toJson(fields: SurgeryFieldDef[]): Prisma.InputJsonValue {
  return fields as unknown as Prisma.InputJsonValue;
}

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const essFields: SurgeryFieldDef[] = [
  { key: "approach", label: "접근 방법", type: "select", options: ["Functional ESS", "Full house ESS", "Revision ESS"] },
  { key: "maxillary_r", label: "우측 상악동(Maxillary) 개방", type: "checkbox" },
  { key: "maxillary_l", label: "좌측 상악동(Maxillary) 개방", type: "checkbox" },
  { key: "ant_ethmoid_r", label: "우측 전사골동(Ant. ethmoid)", type: "checkbox" },
  { key: "ant_ethmoid_l", label: "좌측 전사골동(Ant. ethmoid)", type: "checkbox" },
  { key: "post_ethmoid_r", label: "우측 후사골동(Post. ethmoid)", type: "checkbox" },
  { key: "post_ethmoid_l", label: "좌측 후사골동(Post. ethmoid)", type: "checkbox" },
  { key: "sphenoid_r", label: "우측 접형동(Sphenoid)", type: "checkbox" },
  { key: "sphenoid_l", label: "좌측 접형동(Sphenoid)", type: "checkbox" },
  { key: "frontal_r", label: "우측 전두동(Frontal recess)", type: "checkbox" },
  { key: "frontal_l", label: "좌측 전두동(Frontal recess)", type: "checkbox" },
  { key: "polypectomy", label: "비용종 절제(Polypectomy)", type: "checkbox" },
  { key: "turbinate_reduction", label: "하비갑개 축소술 동반", type: "checkbox" },
  { key: "septoplasty_combined", label: "비중격교정술 동반", type: "checkbox" },
];

const septoFields: SurgeryFieldDef[] = [
  { key: "deviation_direction", label: "만곡 방향", type: "select", options: ["Rt.", "Lt.", "S-shape", "C-shape"] },
  { key: "deviation_location", label: "만곡 부위", type: "select", options: ["Cartilaginous", "Bony", "Both"] },
  { key: "technique", label: "술식", type: "select", options: ["Conventional (Killian)", "Endoscopic septoplasty", "Extracorporeal septoplasty"] },
  { key: "spur", label: "골극(Spur) 동반", type: "checkbox" },
  { key: "spreader_graft", label: "Spreader graft 시행", type: "checkbox" },
  { key: "turbinate_reduction", label: "하비갑개 축소술 동반", type: "checkbox" },
  { key: "caudal_deviation", label: "미측(Caudal) 만곡 교정", type: "checkbox" },
];

async function main() {
  await prisma.surgeryType.upsert({
    where: { code: "ESS" },
    update: { name: "부비동내시경수술 (ESS)", fields: toJson(essFields), isBuiltIn: true },
    create: {
      code: "ESS",
      name: "부비동내시경수술 (ESS)",
      fields: toJson(essFields),
      isBuiltIn: true,
    },
  });

  await prisma.surgeryType.upsert({
    where: { code: "SEPTOPLASTY" },
    update: { name: "비중격교정술 (Septoplasty)", fields: toJson(septoFields), isBuiltIn: true },
    create: {
      code: "SEPTOPLASTY",
      name: "비중격교정술 (Septoplasty)",
      fields: toJson(septoFields),
      isBuiltIn: true,
    },
  });

  console.log("Seed complete: ESS, SEPTOPLASTY surgery types ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
