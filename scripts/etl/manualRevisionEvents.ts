export type ManualRevisionEventRecord = {
  municipalityId: number;
  status: string;
  effectiveDate: string;
  announcedDate: string;
  averageRevisionRate: number | null;
  targetBusiness: string;
  title: string;
  summary: string;
  sourceUrl: string;
  extractionConfidence: number;
  checkedAt: string;
};

type ManualRevisionEventDelegate = {
  findFirst(args: {
    where: ReturnType<typeof manualRevisionEventIdentity>;
    select: { id: true };
  }): Promise<{ id: number } | null>;
  update(args: { where: { id: number }; data: ManualRevisionEventRecord }): Promise<unknown>;
  create(args: { data: ManualRevisionEventRecord }): Promise<unknown>;
};

export function manualRevisionEventIdentity(event: ManualRevisionEventRecord) {
  return {
    municipalityId: event.municipalityId,
    sourceUrl: event.sourceUrl,
    targetBusiness: event.targetBusiness,
    announcedDate: event.announcedDate,
    effectiveDate: event.effectiveDate
  };
}

export async function upsertManualRevisionEvent(
  delegate: ManualRevisionEventDelegate,
  event: ManualRevisionEventRecord
) {
  const existing = await delegate.findFirst({
    where: manualRevisionEventIdentity(event),
    select: { id: true }
  });
  if (existing) {
    await delegate.update({ where: { id: existing.id }, data: event });
    return "updated" as const;
  }
  await delegate.create({ data: event });
  return "created" as const;
}
