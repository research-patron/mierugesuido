import { MunicipalitiesContent } from "@/components/MunicipalitiesContent";
import { getStaticSearchDataset } from "@/lib/staticData";

export default async function MunicipalitiesPage() {
  return <MunicipalitiesContent initialDataset={await getStaticSearchDataset()} />;
}
