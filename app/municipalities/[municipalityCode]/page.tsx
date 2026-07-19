import type { Metadata } from "next";
import { Suspense } from "react";
import { MunicipalityDetailClient } from "@/components/MunicipalityDetailClient";
import { siteName } from "@/lib/copy";
import { formatSettlementFiscalLabel } from "@/lib/format";
import { getStaticManifest, getStaticMunicipalityDetail } from "@/lib/staticData";

export async function generateStaticParams() {
  const manifest = await getStaticManifest();
  return manifest.municipalityCodes.map((municipalityCode) => ({ municipalityCode }));
}
export async function generateMetadata({
  params
}: {
  params: Promise<{ municipalityCode: string }>;
}): Promise<Metadata> {
  const { municipalityCode } = await params;
  const municipality = await getStaticMunicipalityDetail(municipalityCode);
  const latest = municipality.businesses
    .flatMap((business: any) => business.annualFinancials)
    .sort((a: any, b: any) => b.surveyYear - a.surveyYear)[0];
  const fiscal = formatSettlementFiscalLabel({
    surveyYear: latest?.surveyYear,
    fiscalYearLabel: latest?.fiscalYearLabel
  });
  return { title: `${municipality.municipalityName} | ${siteName}（${fiscal}）` };
}

export default async function MunicipalityDetailPage({
  params
}: {
  params: Promise<{ municipalityCode: string }>;
}) {
  const { municipalityCode } = await params;
  return (
    <Suspense fallback={null}>
      <MunicipalityDetailClient municipalityCode={municipalityCode} />
    </Suspense>
  );
}
