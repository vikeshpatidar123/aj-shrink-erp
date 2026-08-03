// Retired — the Job Production module now lives at /gravure/production.
// This old route redirects there so the sidebar menu item + any old bookmark
// always open the latest module (independent of the ModuleMaster menu URL / cache).
import { redirect } from "next/navigation";

export default function JobProductionRedirect() {
  redirect("/gravure/production");
}
