import { db } from "./db";

const DEFAULTS = {
  commissionPercent: "10",
} as const;

type SettingKey = keyof typeof DEFAULTS;

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key];
}

export async function getCommissionPercent(): Promise<number> {
  return Number(await getSetting("commissionPercent"));
}

export async function setSetting(key: SettingKey, value: string) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
