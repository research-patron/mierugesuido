import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { siteName } from "@/lib/copy";

import { MunicipalityDetailClient } from "@/components/MunicipalityDetailClient";
import { mergeCostCompositionIntoDetail } from "@/lib/costCompositionStatic";
import { formatSettlementFiscalLabel } from "@/lib/format";
import {
  fundShortageAssessmentSelectionKey,
  type FundShortageAssessment
} from "@/lib/fundShortage";
import { municipalityFeeRevisionFromStaticIndex } from "@/lib/municipalityFeeRevisionStatic";
import {
  getStaticCostComposition,
  getStaticManifest,
  getStaticMunicipalityDetail,
  getStaticMunicipalityFeeRevisionIndex
} from "@/lib/staticData";
import { getStaticFundShortageAssessment } from "@/lib/staticFundShortageDataset";
import { absoluteSiteUrl, createPageMetadata } from "@/lib/siteMetadata";

function municipalityPageTitle(municipality: Awaited<ReturnType<typeof getStaticMunicipalityDetail>>) {
  const latest = municipality.businesses
    .flatMap((business: any) => business.annualFinancials)
    .sort((a: any, b: any) => b.surveyYear - a.surveyYear)[0];
  const fiscal = formatSettlementFiscalLabel({
    surveyYear: latest?.surveyYear,
    fiscalYearLabel: latest?.fiscalYearLabel
  });
  return `${municipality.prefectureName} ${municipality.municipalityName}の下水道使用料・経費回収率（${fiscal}）`;
}

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
  return { ...createPageMetadata({
    title: municipalityPageTitle(municipality),
    description: `${municipality.prefectureName}${municipality.municipalityName}の下水道使用料と、維持管理費・資本費に分けた料金水準の背景、経費回収率、決算推移を事業別に確認できます。`,
    path: `/municipalities/${municipalityCode}`
  }), title: null, alternates: { canonical: null } };
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
    <>
      <MunicipalityDetailClient
        dataVersion={createHash("sha256").update(JSON.stringify(municipality)).digest("hex")}
        initialTitle={`${municipalityPageTitle(municipality)} | ${siteName}`}
        canonicalBase={absoluteSiteUrl(`/municipalities/${municipalityCode}`)}
        initialMunicipality={mergeCostCompositionIntoDetail(municipality, await getStaticCostComposition(municipalityCode))}
        municipalityCode={municipalityCode}
        fundShortageAssessments={fundShortageAssessments}
        feeRevisionComparison={municipalityFeeRevisionFromStaticIndex(revisionIndex, municipalityCode)}
        availableJointOperatorMunicipalityCodes={availableJointOperatorMunicipalityCodes}
        availableMunicipalityDetailCodes={availableMunicipalityDetailCodes}
      />
    </>
  );
}
