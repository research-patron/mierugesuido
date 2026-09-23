import { RevisionsContent } from "@/components/RevisionsContent";
import { getStaticRevisions } from "@/lib/staticData";

export default async function RevisionsPage() {
  return <RevisionsContent initialDataset={await getStaticRevisions()} />;
}
