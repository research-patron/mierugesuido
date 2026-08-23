import type { Metadata } from "next";
import { Suspense } from "react";
import { MunicipalityDetailClient } from "@/components/MunicipalityDetailClient";
import { siteName } from "@/lib/copy";
import { formatSettlementFiscalLabel } from "@/lib/format";
import {
  fundShortageAssessmentSelectionKey,
  type FundShortageAssessment
} from "@/lib/fundShortage";
import { municipalityFeeRevisionFromStaticIndex } from "@/lib/municipalityFeeRevisionStatic";
import {
  getStaticManifest,
  getStaticMunicipalityDetail,
  getStaticMunicipalityFeeRevisionIndex
} from "@/lib/staticData";
import { getStaticFundShortageAssessment } from "@/lib/staticFundShortageDataset";

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
  const municipality = await getStaticMunicipalityDetail(municipalityCode);
  const assessmentTargets = [...new Map(
    municipality.businesses.map((business: any) => [
      fundShortageAssessmentSelectionKey(business),
      {
        businessKey: business.businessKey as string,
        accountingType: business.accountingType as string
      }
    ])
  ).values()] as Array<{ businessKey: string; accountingType: string }>;
  const fundShortageEntries = await Promise.all(assessmentTargets.map(async (target) => [
    fundShortageAssessmentSelectionKey(target),
    await getStaticFundShortageAssessment({ municipalityCode, ...target })
  ] as const));
  const fundShortageAssessments = Object.fromEntries(fundShortageEntries) as Record<string, FundShortageAssessment>;
  const revisionIndex = await getStaticMunicipalityFeeRevisionIndex();
  const manifest = await getStaticManifest();
  const staticMunicipalityCodes = new Set(manifest.municipalityCodes);
  const prefectureCode = municipality.prefectureCode ?? municipalityCode.slice(0, 2);
  const availableMunicipalityDetailCodes = manifest.municipalityCodes
    .filter((code) => code.slice(0, 2) === prefectureCode);
  const availableJointOperatorMunicipalityCodes = [...new Set<string>(
    municipality.servedServiceMemberships
      .map((membership: any) => membership.operatorMunicipality?.municipalityCode as string | undefined)
      .filter((operatorCode: string | undefined): operatorCode is string => (
        operatorCode != null && staticMunicipalityCodes.has(operatorCode)
      ))
  )];
  return (
    <Suspense fallback={null}>
      <MunicipalityDetailClient
        municipalityCode={municipalityCode}
        fundShortageAssessments={fundShortageAssessments}
        feeRevisionComparison={municipalityFeeRevisionFromStaticIndex(revisionIndex, municipalityCode)}
        availableJointOperatorMunicipalityCodes={availableJointOperatorMunicipalityCodes}
        availableMunicipalityDetailCodes={availableMunicipalityDetailCodes}
      />
    </Suspense>
  );
}
