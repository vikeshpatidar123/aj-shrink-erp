"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List, Users, Mail, Eye, EyeOff } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/othermasterShrink`;

// ── helpers ───────────────────────────────────────────────────────────────────
function unwrap(v: any): any {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}
async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { headers: authHeaders(), ...opts });
  return unwrap(await r.text());
}

// ── shared UI ─────────────────────────────────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">{title}</h3>
);
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white";
const ic = (err?: boolean) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50") : inputCls;
const selectCls = `${inputCls} cursor-pointer`;

// ── types ─────────────────────────────────────────────────────────────────────
type UserRow = {
  id: string;
  UserID: string;
  UserName: string;
  LoginUserName: string;
  ContactNo: string;
  Designation: string;
  EmailID: string;
  BranchName: string;
  ProductionUnitName: string;
  Country: string; State: string; City: string;
  UnderUserID: string; BranchID: string; ProductionUnitID: string;
  Password: string;
  Details: string;
  smtpUserName: string; smtpUserPassword: string; smtpServer: string;
  smtpServerPort: string; smtpAuthenticate: string; smtpUseSSL: string;
  EmailMessage: string; HeaderText: string; FooterText: string;
  ExportHeaderText: string; ExportFooterText: string;
  POEmailMessage: string; POHeaderText: string; POFooterText: string;
  InvoiceEmailMessage: string; InvoiceHeaderText: string; InvoiceFooterText: string;
  InvoiceExportHeaderText: string; InvoiceExportFooterText: string;
  UserWiseOperatorsIDStr: string;
  // permission flags — preserved on update, not shown in UI
  IsAdmin: boolean; IsCreateUser: boolean; IsExtraPaperIssue: boolean;
  IsUserCannotViewCostingDetail: boolean; IsHidden: boolean; ISChooseAnotherPaper: boolean;
  IsEditableProductionDate: boolean; AllowAccessTallyInterface: boolean;
  AllowDuplicatePONoInSO: boolean; AcceptSOLessThanEstimatedQty: boolean;
  CanDeleteQuotation: boolean; CanReviseQuotation: boolean; CanCopyQuotation: boolean;
  CanPrintQuotation: boolean; CanReviewQuotation: boolean; CanSendQuotationForSO: boolean;
  CanRejectQuotation: boolean; CanCheckEstimatedJobDetails: boolean;
  CanCheckEstimatedDetailCosting: boolean; CanChangePODate: boolean;
  CanEditPOQuantityAndRate: boolean; CanEditProductionDate: boolean;
  CanPackMoreThanSOQty: boolean; CanCreateDirectPacking: boolean;
  CanEditApprovedCostInPriceApproval: boolean; CanEditRateInSO: boolean;
  CanChangeClientOnSO: boolean; CanAccessMultipleBranchData: boolean;
  CanEditMaterialCostParameter: boolean; CanUpdateSODetails: boolean;
  IsChallanBlockFeatureRequired: boolean; IsInvoiceBlockFeatureRequired: boolean;
  CanIReplanthePWOorProductCatalog: boolean; CanAccessMultipleProductionUnitData: boolean;
  CanAddAdditionalProcessesInPWO: boolean; IsEventOTP: boolean;
  IsSaveEditClosedJobProcess: boolean; IsDeleteProductionEntry: boolean;
  IsModifyScheduleProcess: boolean; IsCreateDirectInvoice: boolean;
  IsUpdateOutSourceInvoiceQuantity: boolean; IsUserViewOtherQuotation: boolean;
  CanReceiveExcessMaterial: boolean;
};

type FormState = {
  UserName: string; LoginUserName: string; Password: string; REPassword: string;
  ContactNo: string; UnderUserID: string; Designation: string; EmailID: string;
  Country: string; State: string; City: string; BranchID: string; ProductionUnitID: string;
  Details: string;
  smtpUserName: string; smtpUserPassword: string; RESMTPPassword: string;
  smtpServer: string; smtpServerPort: string; smtpAuthenticate: string; smtpUseSSL: string;
  EmailMessage: string; HeaderText: string; FooterText: string;
  ExportHeaderText: string; ExportFooterText: string;
  POEmailMessage: string; POHeaderText: string; POFooterText: string;
  InvoiceEmailMessage: string; InvoiceHeaderText: string; InvoiceFooterText: string;
  InvoiceExportHeaderText: string; InvoiceExportFooterText: string;
  // flags kept in state for data-integrity on update (not shown in UI)
  IsAdmin: boolean; IsCreateUser: boolean; IsExtraPaperIssue: boolean;
  IsUserCannotViewCostingDetail: boolean; IsHidden: boolean; ISChooseAnotherPaper: boolean;
  IsEditableProductionDate: boolean; AllowAccessTallyInterface: boolean;
  AllowDuplicatePONoInSO: boolean; AcceptSOLessThanEstimatedQty: boolean;
  CanDeleteQuotation: boolean; CanReviseQuotation: boolean; CanCopyQuotation: boolean;
  CanPrintQuotation: boolean; CanReviewQuotation: boolean; CanSendQuotationForSO: boolean;
  CanRejectQuotation: boolean; CanCheckEstimatedJobDetails: boolean;
  CanCheckEstimatedDetailCosting: boolean; CanChangePODate: boolean;
  CanEditPOQuantityAndRate: boolean; CanEditProductionDate: boolean;
  CanPackMoreThanSOQty: boolean; CanCreateDirectPacking: boolean;
  CanEditApprovedCostInPriceApproval: boolean; CanEditRateInSO: boolean;
  CanChangeClientOnSO: boolean; CanAccessMultipleBranchData: boolean;
  CanEditMaterialCostParameter: boolean; CanUpdateSODetails: boolean;
  IsChallanBlockFeatureRequired: boolean; IsInvoiceBlockFeatureRequired: boolean;
  CanIReplanthePWOorProductCatalog: boolean; CanAccessMultipleProductionUnitData: boolean;
  CanAddAdditionalProcessesInPWO: boolean; IsEventOTP: boolean;
  IsSaveEditClosedJobProcess: boolean; IsDeleteProductionEntry: boolean;
  IsModifyScheduleProcess: boolean; IsCreateDirectInvoice: boolean;
  IsUpdateOutSourceInvoiceQuantity: boolean; IsUserViewOtherQuotation: boolean;
  CanReceiveExcessMaterial: boolean;
};

const blankFlags = () => ({
  IsAdmin: false, IsCreateUser: false, IsExtraPaperIssue: false,
  IsUserCannotViewCostingDetail: false, IsHidden: false, ISChooseAnotherPaper: false,
  IsEditableProductionDate: false, AllowAccessTallyInterface: false,
  AllowDuplicatePONoInSO: false, AcceptSOLessThanEstimatedQty: false,
  CanDeleteQuotation: false, CanReviseQuotation: false, CanCopyQuotation: false,
  CanPrintQuotation: false, CanReviewQuotation: false, CanSendQuotationForSO: false,
  CanRejectQuotation: false, CanCheckEstimatedJobDetails: false,
  CanCheckEstimatedDetailCosting: false, CanChangePODate: false,
  CanEditPOQuantityAndRate: false, CanEditProductionDate: false,
  CanPackMoreThanSOQty: false, CanCreateDirectPacking: false,
  CanEditApprovedCostInPriceApproval: false, CanEditRateInSO: false,
  CanChangeClientOnSO: false, CanAccessMultipleBranchData: false,
  CanEditMaterialCostParameter: false, CanUpdateSODetails: false,
  IsChallanBlockFeatureRequired: false, IsInvoiceBlockFeatureRequired: false,
  CanIReplanthePWOorProductCatalog: false, CanAccessMultipleProductionUnitData: false,
  CanAddAdditionalProcessesInPWO: false, IsEventOTP: false,
  IsSaveEditClosedJobProcess: false, IsDeleteProductionEntry: false,
  IsModifyScheduleProcess: false, IsCreateDirectInvoice: false,
  IsUpdateOutSourceInvoiceQuantity: false, IsUserViewOtherQuotation: false,
  CanReceiveExcessMaterial: false,
});

const blank = (): FormState => ({
  UserName: "", LoginUserName: "", Password: "", REPassword: "",
  ContactNo: "", UnderUserID: "", Designation: "", EmailID: "",
  Country: "", State: "", City: "", BranchID: "", ProductionUnitID: "",
  Details: "",
  smtpUserName: "", smtpUserPassword: "", RESMTPPassword: "",
  smtpServer: "", smtpServerPort: "", smtpAuthenticate: "False", smtpUseSSL: "False",
  EmailMessage: "", HeaderText: "", FooterText: "",
  ExportHeaderText: "", ExportFooterText: "",
  POEmailMessage: "", POHeaderText: "", POFooterText: "",
  InvoiceEmailMessage: "", InvoiceHeaderText: "", InvoiceFooterText: "",
  InvoiceExportHeaderText: "", InvoiceExportFooterText: "",
  ...blankFlags(),
});

type Tab = "profile" | "mailsettings";

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function UserMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [showPwd, setShowPwd] = useState(false);
  const [showRePwd, setShowRePwd] = useState(false);

  // dropdowns
  const [underUsers, setUnderUsers] = useState<{ UserID: string; UserName: string }[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [countries, setCountries] = useState<{ Country: string }[]>([]);
  const [states, setStates] = useState<{ State: string }[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [productionUnits, setProductionUnits] = useState<any[]>([]);

  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "User Master" : "User Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── load list ─────────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true);
    apiFetch(`${BASE}/getuser`)
      .then(raw => setData(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.UserID) })) : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  // ── load dropdowns ────────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(`${BASE}/underuser`).then(r => setUnderUsers(Array.isArray(r) ? r : [])).catch(() => { });
    apiFetch(`${BASE}/userdesignation`).then(r => {
      if (Array.isArray(r)) setDesignations(r.map((x: any) => x.Designation).filter(Boolean));
    }).catch(() => { });
    apiFetch(`${BASE}/getcountry`).then(r => setCountries(Array.isArray(r) ? r : [])).catch(() => { });
    apiFetch(`${BASE}/getstate`).then(r => setStates(Array.isArray(r) ? r : [])).catch(() => { });
    apiFetch(`${BASE}/getbranch`).then(r => setBranches(Array.isArray(r) ? r : [])).catch(() => { });
    apiFetch(`${BASE}/getproductionunitlist`).then(r => setProductionUnits(Array.isArray(r) ? r : [])).catch(() => { });
  }, []);

  // ── open add ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setActiveTab("profile");
    setSubmitAttempted(false);
    setShowPwd(false); setShowRePwd(false);
    setView("form");
  };

  // ── open edit ─────────────────────────────────────────────────────────────────
  const openEdit = (row: UserRow) => {
    setEditing(row);
    setError("");
    setSubmitAttempted(false);
    setActiveTab("profile");
    setShowPwd(false); setShowRePwd(false);
    setForm({
      UserName: row.UserName ?? "",
      LoginUserName: row.LoginUserName ?? "",
      Password: row.Password ?? "",
      REPassword: row.Password ?? "",
      ContactNo: row.ContactNo ?? "",
      UnderUserID: String(row.UnderUserID ?? ""),
      Designation: row.Designation ?? "",
      EmailID: row.EmailID ?? "",
      Country: row.Country ?? "",
      State: row.State ?? "",
      City: row.City ?? "",
      BranchID: String(row.BranchID ?? ""),
      ProductionUnitID: String(row.ProductionUnitID ?? ""),
      Details: row.Details ?? "",
      smtpUserName: row.smtpUserName ?? "",
      smtpUserPassword: row.smtpUserPassword ?? "",
      RESMTPPassword: row.smtpUserPassword ?? "",
      smtpServer: row.smtpServer ?? "",
      smtpServerPort: row.smtpServerPort ?? "",
      smtpAuthenticate: row.smtpAuthenticate ?? "False",
      smtpUseSSL: row.smtpUseSSL ?? "False",
      EmailMessage: row.EmailMessage ?? "",
      HeaderText: row.HeaderText ?? "",
      FooterText: row.FooterText ?? "",
      ExportHeaderText: row.ExportHeaderText ?? "",
      ExportFooterText: row.ExportFooterText ?? "",
      POEmailMessage: row.POEmailMessage ?? "",
      POHeaderText: row.POHeaderText ?? "",
      POFooterText: row.POFooterText ?? "",
      InvoiceEmailMessage: row.InvoiceEmailMessage ?? "",
      InvoiceHeaderText: row.InvoiceHeaderText ?? "",
      InvoiceFooterText: row.InvoiceFooterText ?? "",
      InvoiceExportHeaderText: row.InvoiceExportHeaderText ?? "",
      InvoiceExportFooterText: row.InvoiceExportFooterText ?? "",
      // preserve existing flags — don't wipe permissions on a basic-info save
      IsAdmin: !!row.IsAdmin, IsCreateUser: !!row.IsCreateUser,
      IsExtraPaperIssue: !!row.IsExtraPaperIssue,
      IsUserCannotViewCostingDetail: !!row.IsUserCannotViewCostingDetail,
      IsHidden: !!row.IsHidden, ISChooseAnotherPaper: !!row.ISChooseAnotherPaper,
      IsEditableProductionDate: !!row.IsEditableProductionDate,
      AllowAccessTallyInterface: !!row.AllowAccessTallyInterface,
      AllowDuplicatePONoInSO: !!row.AllowDuplicatePONoInSO,
      AcceptSOLessThanEstimatedQty: !!row.AcceptSOLessThanEstimatedQty,
      CanDeleteQuotation: !!row.CanDeleteQuotation, CanReviseQuotation: !!row.CanReviseQuotation,
      CanCopyQuotation: !!row.CanCopyQuotation, CanPrintQuotation: !!row.CanPrintQuotation,
      CanReviewQuotation: !!row.CanReviewQuotation, CanSendQuotationForSO: !!row.CanSendQuotationForSO,
      CanRejectQuotation: !!row.CanRejectQuotation,
      CanCheckEstimatedJobDetails: !!row.CanCheckEstimatedJobDetails,
      CanCheckEstimatedDetailCosting: !!row.CanCheckEstimatedDetailCosting,
      CanChangePODate: !!row.CanChangePODate, CanEditPOQuantityAndRate: !!row.CanEditPOQuantityAndRate,
      CanEditProductionDate: !!row.CanEditProductionDate,
      CanPackMoreThanSOQty: !!row.CanPackMoreThanSOQty,
      CanCreateDirectPacking: !!row.CanCreateDirectPacking,
      CanEditApprovedCostInPriceApproval: !!row.CanEditApprovedCostInPriceApproval,
      CanEditRateInSO: !!row.CanEditRateInSO, CanChangeClientOnSO: !!row.CanChangeClientOnSO,
      CanAccessMultipleBranchData: !!row.CanAccessMultipleBranchData,
      CanEditMaterialCostParameter: !!row.CanEditMaterialCostParameter,
      CanUpdateSODetails: !!row.CanUpdateSODetails,
      IsChallanBlockFeatureRequired: !!row.IsChallanBlockFeatureRequired,
      IsInvoiceBlockFeatureRequired: !!row.IsInvoiceBlockFeatureRequired,
      CanIReplanthePWOorProductCatalog: !!row.CanIReplanthePWOorProductCatalog,
      CanAccessMultipleProductionUnitData: !!row.CanAccessMultipleProductionUnitData,
      CanAddAdditionalProcessesInPWO: !!row.CanAddAdditionalProcessesInPWO,
      IsEventOTP: !!row.IsEventOTP,
      IsSaveEditClosedJobProcess: !!row.IsSaveEditClosedJobProcess,
      IsDeleteProductionEntry: !!row.IsDeleteProductionEntry,
      IsModifyScheduleProcess: !!row.IsModifyScheduleProcess,
      IsCreateDirectInvoice: !!row.IsCreateDirectInvoice,
      IsUpdateOutSourceInvoiceQuantity: !!row.IsUpdateOutSourceInvoiceQuantity,
      IsUserViewOtherQuotation: !!row.IsUserViewOtherQuotation,
      CanReceiveExcessMaterial: !!row.CanReceiveExcessMaterial,
    });
    setView("form");
  };

  // ── validate ──────────────────────────────────────────────────────────────────
  const validate = (): string => {
    if (!form.UserName.trim()) return "User Name is required.";
    if (!form.LoginUserName.trim()) return "Login User Name is required.";
    if (!editing && !form.Password.trim()) return "Password is required.";
    if (!editing && form.Password !== form.REPassword) return "Passwords do not match.";
    if (!form.ContactNo.trim()) return "Contact No. is required.";
    if (!form.UnderUserID) return "Under User is required.";
    if (!form.Designation.trim()) return "Designation is required.";
    if (!form.ProductionUnitID) return "Production Unit is required.";
    return "";
  };

  // ── save ──────────────────────────────────────────────────────────────────────
  const saveUser = async () => {
    setSubmitAttempted(true);
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError("");

    const userMasterObj = [{
      UserName: form.UserName, LoginUserName: form.LoginUserName,
      Password: form.Password, ContactNo: form.ContactNo,
      UnderUserID: form.UnderUserID, Designation: form.Designation,
      EmailID: form.EmailID, Country: form.Country, State: form.State, City: form.City,
      BranchID: form.BranchID || null, ProductionUnitID: form.ProductionUnitID || null,
      Details: form.Details,
      smtpUserName: form.smtpUserName, smtpUserPassword: form.smtpUserPassword,
      smtpServer: form.smtpServer, smtpServerPort: form.smtpServerPort,
      smtpAuthenticate: form.smtpAuthenticate, smtpUseSSL: form.smtpUseSSL,
      EmailMessage: form.EmailMessage?.replace(/\n/g, "<br >"),
      HeaderText: form.HeaderText?.replace(/\n/g, "<br >"),
      FooterText: form.FooterText?.replace(/\n/g, "<br >"),
      ExportHeaderText: form.ExportHeaderText?.replace(/\n/g, "<br >"),
      ExportFooterText: form.ExportFooterText?.replace(/\n/g, "<br >"),
      POEmailMessage: form.POEmailMessage?.replace(/\n/g, "<br >"),
      POHeaderText: form.POHeaderText?.replace(/\n/g, "<br >"),
      POFooterText: form.POFooterText?.replace(/\n/g, "<br >"),
      InvoiceEmailMessage: form.InvoiceEmailMessage?.replace(/\n/g, "<br >"),
      InvoiceHeaderText: form.InvoiceHeaderText?.replace(/\n/g, "<br >"),
      InvoiceFooterText: form.InvoiceFooterText?.replace(/\n/g, "<br >"),
      InvoiceExportHeaderText: form.InvoiceExportHeaderText?.replace(/\n/g, "<br >"),
      InvoiceExportFooterText: form.InvoiceExportFooterText?.replace(/\n/g, "<br >"),
      // pass through all flags unchanged
      IsAdmin: form.IsAdmin, IsCreateUser: form.IsCreateUser,
      IsExtraPaperIssue: form.IsExtraPaperIssue,
      IsUserCannotViewCostingDetail: form.IsUserCannotViewCostingDetail,
      IsHidden: form.IsHidden, ISChooseAnotherPaper: form.ISChooseAnotherPaper,
      IsEditableProductionDate: form.IsEditableProductionDate,
      AllowAccessTallyInterface: form.AllowAccessTallyInterface,
      AllowDuplicatePONoInSO: form.AllowDuplicatePONoInSO,
      AcceptSOLessThanEstimatedQty: form.AcceptSOLessThanEstimatedQty,
      CanDeleteQuotation: form.CanDeleteQuotation, CanReviseQuotation: form.CanReviseQuotation,
      CanCopyQuotation: form.CanCopyQuotation, CanPrintQuotation: form.CanPrintQuotation,
      CanReviewQuotation: form.CanReviewQuotation, CanSendQuotationForSO: form.CanSendQuotationForSO,
      CanRejectQuotation: form.CanRejectQuotation,
      CanCheckEstimatedJobDetails: form.CanCheckEstimatedJobDetails,
      CanCheckEstimatedDetailCosting: form.CanCheckEstimatedDetailCosting,
      CanChangePODate: form.CanChangePODate, CanEditPOQuantityAndRate: form.CanEditPOQuantityAndRate,
      CanEditProductionDate: form.CanEditProductionDate,
      CanPackMoreThanSOQty: form.CanPackMoreThanSOQty,
      CanCreateDirectPacking: form.CanCreateDirectPacking,
      CanEditApprovedCostInPriceApproval: form.CanEditApprovedCostInPriceApproval,
      CanEditRateInSO: form.CanEditRateInSO, CanChangeClientOnSO: form.CanChangeClientOnSO,
      CanAccessMultipleBranchData: form.CanAccessMultipleBranchData,
      CanEditMaterialCostParameter: form.CanEditMaterialCostParameter,
      CanUpdateSODetails: form.CanUpdateSODetails,
      IsChallanBlockFeatureRequired: form.IsChallanBlockFeatureRequired,
      IsInvoiceBlockFeatureRequired: form.IsInvoiceBlockFeatureRequired,
      CanIReplanthePWOorProductCatalog: form.CanIReplanthePWOorProductCatalog,
      CanAccessMultipleProductionUnitData: form.CanAccessMultipleProductionUnitData,
      CanAddAdditionalProcessesInPWO: form.CanAddAdditionalProcessesInPWO,
      IsEventOTP: form.IsEventOTP, IsSaveEditClosedJobProcess: form.IsSaveEditClosedJobProcess,
      IsDeleteProductionEntry: form.IsDeleteProductionEntry,
      IsModifyScheduleProcess: form.IsModifyScheduleProcess,
      IsCreateDirectInvoice: form.IsCreateDirectInvoice,
      IsUpdateOutSourceInvoiceQuantity: form.IsUpdateOutSourceInvoiceQuantity,
      IsUserViewOtherQuotation: form.IsUserViewOtherQuotation,
      CanReceiveExcessMaterial: form.CanReceiveExcessMaterial,
    }];

    try {
      let result: any;
      if (editing) {
        const res = await fetch(`${BASE}/updateusermasterdata`, {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            LoginUserName: form.LoginUserName,
            CostingDataUserMaster: userMasterObj,
            SegmentUserDataAllocation: [],
            TxtUserid: String(editing.UserID),
            FolderImgDel: "",
            ModuleID: "0",
            ModuleName: "ModuleName",
            OperatorAllocation: [],
          }),
        });
        result = unwrap(await res.text());
      } else {
        const res = await fetch(`${BASE}/saveuserdata`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataUserMaster: userMasterObj,
            OperatorAllocation: [],
            SegmentUserDataAllocation: [],
            SaveFlag: false,
            Userid: "",
            LoginUserName: form.LoginUserName,
          }),
        });
        result = unwrap(await res.text());
      }

      if (result === "Success") {
        loadList();
        setView("list");
      } else if (typeof result === "string" && result.toLowerCase().includes("exist")) {
        setError("Login User Name already exists. Please choose another.");
      } else if (typeof result === "string" && result.toLowerCase().includes("not authorized")) {
        setError(result);
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── delete ────────────────────────────────────────────────────────────────────
  const deleteUser = async (row: UserRow) => {
    if (!confirm(`Delete user "${row.UserName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${BASE}/deleteusermaster?Userid=${row.UserID}`, {
        method: "POST", headers: authHeaders(),
      });
      const result = unwrap(await res.text());
      if (result === "Success") loadList();
      else alert(result || "Delete failed.");
    } catch (e: any) { alert("Error: " + e.message); }
  };

  // ── list columns ──────────────────────────────────────────────────────────────
  const columns: Column<UserRow>[] = [
    { key: "UserID", header: "ID", sortable: true },
    { key: "UserName", header: "User Name", sortable: true },
    { key: "LoginUserName", header: "Login Name", sortable: true },
    { key: "Designation", header: "Designation", sortable: true },
    { key: "ContactNo", header: "Contact No", sortable: true },
    { key: "EmailID", header: "Email", sortable: true },
    { key: "BranchName", header: "Branch", sortable: true },
    { key: "ProductionUnitName", header: "Production Unit", sortable: true },
  ];

  // ══════════════════════════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  if (view === "form") {
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
      { id: "profile", label: "User Profile", icon: <Users size={14} /> },
      { id: "mailsettings", label: "Mail Settings", icon: <Mail size={14} /> },
    ];

    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">
              {editing ? `Edit User — ${editing.UserName}` : "New User"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveUser} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {editing ? "Update User" : "Save User"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tab bar */}
          <div className="px-4 pt-4 pb-0 border-b border-gray-200 bg-gray-50/40 flex gap-1">
            {editing && (
              <div className="w-full mb-2 flex items-center">
                <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                  ID: {editing.UserID}
                </span>
              </div>
            )}
            {!editing && tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 rounded-t transition-colors ${activeTab === t.id
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}>
                {t.icon}{t.label}
              </button>
            ))}
            {editing && tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 rounded-t transition-colors ${activeTab === t.id
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── TAB: USER PROFILE ── */}
            {activeTab === "profile" && (
              <div>
                <SectionTitle title="Basic Information" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <Field label="User Name" required>
                    <input type="text" value={form.UserName}
                      onChange={e => f("UserName", e.target.value)}
                      placeholder="Full name"
                      className={ic(submitAttempted && !form.UserName.trim())} />
                  </Field>

                  <Field label="Login User Name" required>
                    <input type="text" value={form.LoginUserName}
                      onChange={e => f("LoginUserName", e.target.value)}
                      placeholder="ajshrink"
                      className={ic(submitAttempted && !form.LoginUserName.trim())} />
                  </Field>

                  {!editing && (
                    <>
                      <Field label="Password" required>
                        <div className="relative">
                          <input type={showPwd ? "text" : "password"} value={form.Password}
                            onChange={e => f("Password", e.target.value)}
                            className={ic(submitAttempted && !form.Password.trim()) + " pr-10"} />
                          <button type="button" onClick={() => setShowPwd(p => !p)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </Field>
                      <Field label="Re-Type Password" required>
                        <div className="relative">
                          <input type={showRePwd ? "text" : "password"} value={form.REPassword}
                            onChange={e => f("REPassword", e.target.value)}
                            className={ic(submitAttempted && form.Password !== form.REPassword) + " pr-10"} />
                          <button type="button" onClick={() => setShowRePwd(p => !p)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showRePwd ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </Field>
                    </>
                  )}

                  <Field label="Contact No." required>
                    <input type="text" value={form.ContactNo}
                      onChange={e => f("ContactNo", e.target.value.replace(/[^0-9]/g, ""))}
                      maxLength={13} placeholder="Mobile number"
                      className={ic(submitAttempted && !form.ContactNo.trim())} />
                  </Field>

                  <Field label="Under User" required>
                    <select value={form.UnderUserID} onChange={e => f("UnderUserID", e.target.value)}
                      className={ic(submitAttempted && !form.UnderUserID).replace(inputCls, selectCls)}>
                      <option value="">-- Select --</option>
                      {underUsers.map(u => <option key={u.UserID} value={u.UserID}>{u.UserName}</option>)}
                    </select>
                  </Field>

                  <Field label="Designation" required>
                    <input list="designations-list" type="text" value={form.Designation}
                      onChange={e => f("Designation", e.target.value)}
                      placeholder="e.g. Manager"
                      className={ic(submitAttempted && !form.Designation.trim())} />
                    <datalist id="designations-list">
                      {designations.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </Field>

                  <Field label="Email ID">
                    <input type="email" value={form.EmailID}
                      onChange={e => f("EmailID", e.target.value)}
                      placeholder="email@company.com" className={inputCls} />
                  </Field>

                  <Field label="Country">
                    <select value={form.Country} onChange={e => f("Country", e.target.value)} className={selectCls}>
                      <option value="">-- Select --</option>
                      {countries.map(c => <option key={c.Country} value={c.Country}>{c.Country}</option>)}
                    </select>
                  </Field>

                  <Field label="State">
                    <select value={form.State} onChange={e => f("State", e.target.value)} className={selectCls}>
                      <option value="">-- Select --</option>
                      {states.map(s => <option key={s.State} value={s.State}>{s.State}</option>)}
                    </select>
                  </Field>

                  <Field label="City">
                    <input type="text" value={form.City}
                      onChange={e => f("City", e.target.value)}
                      placeholder="City" className={inputCls} />
                  </Field>

                  <Field label="Branch">
                    <select value={form.BranchID} onChange={e => f("BranchID", e.target.value)} className={selectCls}>
                      <option value="">-- Select --</option>
                      {branches.map(b => <option key={b.BranchID} value={b.BranchID}>{b.BranchName}</option>)}
                    </select>
                  </Field>

                  <Field label="Production Unit" required>
                    <select value={form.ProductionUnitID} onChange={e => f("ProductionUnitID", e.target.value)}
                      className={ic(submitAttempted && !form.ProductionUnitID).replace(inputCls, selectCls)}>
                      <option value="">-- Select --</option>
                      {productionUnits.map(p => <option key={p.ProductionUnitID} value={p.ProductionUnitID}>{p.ProductionUnitName}</option>)}
                    </select>
                  </Field>

                  <div className="lg:col-span-3">
                    <Field label="Details">
                      <textarea value={form.Details} onChange={e => f("Details", e.target.value)}
                        rows={2} placeholder="Additional notes..." className={inputCls} />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: MAIL SETTINGS ── */}
            {activeTab === "mailsettings" && (
              <div className="space-y-8">
                <div>
                  <SectionTitle title="SMTP Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <Field label="SMTP User Name">
                      <input type="text" value={form.smtpUserName}
                        onChange={e => f("smtpUserName", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="SMTP Password">
                      <input type="password" value={form.smtpUserPassword}
                        onChange={e => f("smtpUserPassword", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Re-Type SMTP Password">
                      <input type="password" value={form.RESMTPPassword}
                        onChange={e => f("RESMTPPassword", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="SMTP Server">
                      <input type="text" value={form.smtpServer}
                        onChange={e => f("smtpServer", e.target.value)}
                        placeholder="smtp.gmail.com" className={inputCls} />
                    </Field>
                    <Field label="SMTP Server Port">
                      <input type="text" value={form.smtpServerPort}
                        onChange={e => f("smtpServerPort", e.target.value)}
                        placeholder="587" className={inputCls} />
                    </Field>
                    <Field label="Authenticate">
                      <select value={form.smtpAuthenticate}
                        onChange={e => f("smtpAuthenticate", e.target.value)} className={selectCls}>
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    </Field>
                    <Field label="Use SSL">
                      <select value={form.smtpUseSSL}
                        onChange={e => f("smtpUseSSL", e.target.value)} className={selectCls}>
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Quote Mail Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Email Message">
                      <textarea rows={3} value={form.EmailMessage}
                        onChange={e => f("EmailMessage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Header Text">
                      <textarea rows={3} value={form.HeaderText}
                        onChange={e => f("HeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Footer Text">
                      <textarea rows={3} value={form.FooterText}
                        onChange={e => f("FooterText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Export Header Text">
                      <textarea rows={3} value={form.ExportHeaderText}
                        onChange={e => f("ExportHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Export Footer Text">
                      <textarea rows={3} value={form.ExportFooterText}
                        onChange={e => f("ExportFooterText", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="PO Mail Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="PO Email Message">
                      <textarea rows={3} value={form.POEmailMessage}
                        onChange={e => f("POEmailMessage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="PO Header Text">
                      <textarea rows={3} value={form.POHeaderText}
                        onChange={e => f("POHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="PO Footer Text">
                      <textarea rows={3} value={form.POFooterText}
                        onChange={e => f("POFooterText", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Invoice Mail Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Invoice Email Message">
                      <textarea rows={3} value={form.InvoiceEmailMessage}
                        onChange={e => f("InvoiceEmailMessage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Header Text">
                      <textarea rows={3} value={form.InvoiceHeaderText}
                        onChange={e => f("InvoiceHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Footer Text">
                      <textarea rows={3} value={form.InvoiceFooterText}
                        onChange={e => f("InvoiceFooterText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Export Header Text">
                      <textarea rows={3} value={form.InvoiceExportHeaderText}
                        onChange={e => f("InvoiceExportHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Export Footer Text">
                      <textarea rows={3} value={form.InvoiceExportFooterText}
                        onChange={e => f("InvoiceExportFooterText", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">User Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${data.length} user${data.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["UserName", "LoginUserName", "Designation", "EmailID", "ContactNo"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteUser(row)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
