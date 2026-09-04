import type { Metadata } from "next";
import { ReviewWorkspace } from "@/components/review-workspace";

export const metadata: Metadata = {
  title: "Review report",
  description: "Review, correct, verify, and export a structured Ìròyìn incident report.",
};

export default async function ReviewPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <ReviewWorkspace caseId={decodeURIComponent(caseId)} />;
}
