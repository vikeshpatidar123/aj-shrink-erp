// Retired duplicate — the active QC & Packing module lives at /gravure/production/qc-packing.
// This route redirects there so any old bookmark/link keeps working.
import { redirect } from "next/navigation";

export default function QcPackingRedirect() {
  redirect("/gravure/production/qc-packing");
}
