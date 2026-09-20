import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { SurgeryFieldDef } from "../src/lib/field-types";
import {
  essFullFields,
  septoplastyFullFields,
  comboFullFields,
} from "../src/lib/op-note-defs";

function toJson(fields: SurgeryFieldDef[]): Prisma.InputJsonValue {
  return fields as unknown as Prisma.InputJsonValue;
}

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.surgeryType.upsert({
    where: { code: "ESS" },
    update: { name: "부비동내시경수술 (FESS)", fields: toJson(essFullFields), isBuiltIn: true },
    create: {
      code: "ESS",
      name: "부비동내시경수술 (FESS)",
      fields: toJson(essFullFields),
      isBuiltIn: true,
    },
  });

  await prisma.surgeryType.upsert({
    where: { code: "SEPTOPLASTY" },
    update: { name: "비중격교정술 (Septoturbinoplasty)", fields: toJson(septoplastyFullFields), isBuiltIn: true },
    create: {
      code: "SEPTOPLASTY",
      name: "비중격교정술 (Septoturbinoplasty)",
      fields: toJson(septoplastyFullFields),
      isBuiltIn: true,
    },
  });

  await prisma.surgeryType.upsert({
    where: { code: "COMBO" },
    update: { name: "비중격교정술 + FESS 병행", fields: toJson(comboFullFields), isBuiltIn: true },
    create: {
      code: "COMBO",
      name: "비중격교정술 + FESS 병행",
      fields: toJson(comboFullFields),
      isBuiltIn: true,
    },
  });

  console.log("Seed complete: ESS, SEPTOPLASTY, COMBO surgery types ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
