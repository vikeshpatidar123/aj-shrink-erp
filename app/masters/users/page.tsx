"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, Check, Loader2, List, Key, Shield,
  Users, Mail, ChevronDown, ChevronUp, Eye, EyeOff
} from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/othermaster`;
const AUTH_BASE = `${BASE_URL}/api/userauthentication`;

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function unwrap(v: any): any {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}
async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { headers: authHeaders(), ...opts });
  return unwrap(await r.text());
}

// â”€â”€ shared UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
const Chk = ({ id, label, checked, onChange, disabled }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
    <input
      type="checkbox" id={id} checked={checked} disabled={disabled}
      onChange={e => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
    />
    {label}
  </label>
);

// â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  IsAdmin: boolean;
  Country: string;
  State: string;
  City: string;
  UnderUserID: string;
  BranchID: string;
  ProductionUnitID: string;
  Password: string;
  smtpUserName: string;
  smtpUserPassword: string;
  smtpServer: string;
  smtpServerPort: string;
  smtpAuthenticate: string;
  smtpUseSSL: string;
  Details: string;
  ProfilePicHref: string;
  SignPicHref: string;
  UserWiseOperatorsIDStr: string;
  EmailMessage: string; HeaderText: string; FooterText: string;
  ExportHeaderText: string; ExportFooterText: string;
  POEmailMessage: string; POHeaderText: string; POFooterText: string;
  InvoiceEmailMessage: string; InvoiceHeaderText: string; InvoiceFooterText: string;
  InvoiceExportHeaderText: string; InvoiceExportFooterText: string;
  // flags
  IsCreateUser: boolean; IsExtraPaperIssue: boolean; IsUserCannotViewCostingDetail: boolean;
  IsHidden: boolean; ISChooseAnotherPaper: boolean; IsEditableProductionDate: boolean;
  AllowAccessTallyInterface: boolean; AllowDuplicatePONoInSO: boolean;
  AcceptSOLessThanEstimatedQty: boolean; CanDeleteQuotation: boolean;
  CanReviseQuotation: boolean; CanCopyQuotation: boolean; CanPrintQuotation: boolean;
  CanReviewQuotation: boolean; CanSendQuotationForSO: boolean; CanRejectQuotation: boolean;
  CanCheckEstimatedJobDetails: boolean; CanCheckEstimatedDetailCosting: boolean;
  CanChangePODate: boolean; CanEditPOQuantityAndRate: boolean; CanEditProductionDate: boolean;
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

type ModuleRow = {
  ModuleID: number; ModuleHeadName: string; ModuleDisplayName: string;
  SetGroupIndex: number; ModuleHeadDisplayOrder: number; ModuleName: string;
  CanView: boolean; CanSave: boolean; CanEdit: boolean;
  CanDelete: boolean; CanExport: boolean; CanPrint: boolean; CanCancel: boolean;
};

type SubModuleRow = {
  ModuleID: number; ModuleName: string; ModuleType: string;
  CanView: boolean; CanSave: boolean; CanEdit: boolean;
  CanDelete: boolean; CanExport: boolean; CanPrint: boolean;
};

type OperatorRow = { LedgerID: number; LedgerName: string };
type SegmentRow = { SegmentID: number; SegmentName: string };

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

type FormState = {
  UserName: string; LoginUserName: string; Password: string; REPassword: string;
  ContactNo: string; UnderUserID: string; Designation: string; EmailID: string;
  Country: string; State: string; City: string; BranchID: string; ProductionUnitID: string;
  smtpUserName: string; smtpUserPassword: string; RESMTPPassword: string;
  smtpServer: string; smtpServerPort: string; smtpAuthenticate: string; smtpUseSSL: string;
  Details: string;
  EmailMessage: string; HeaderText: string; FooterText: string;
  ExportHeaderText: string; ExportFooterText: string;
  POEmailMessage: string; POHeaderText: string; POFooterText: string;
  InvoiceEmailMessage: string; InvoiceHeaderText: string; InvoiceFooterText: string;
  InvoiceExportHeaderText: string; InvoiceExportFooterText: string;
} & ReturnType<typeof blankFlags>;

const blank = (): FormState => ({
  UserName: "", LoginUserName: "", Password: "", REPassword: "",
  ContactNo: "", UnderUserID: "", Designation: "", EmailID: "",
  Country: "", State: "", City: "", BranchID: "", ProductionUnitID: "",
  smtpUserName: "", smtpUserPassword: "", RESMTPPassword: "",
  smtpServer: "", smtpServerPort: "", smtpAuthenticate: "False", smtpUseSSL: "False",
  Details: "",
  EmailMessage: "", HeaderText: "", FooterText: "",
  ExportHeaderText: "", ExportFooterText: "",
  POEmailMessage: "", POHeaderText: "", POFooterText: "",
  InvoiceEmailMessage: "", InvoiceHeaderText: "", InvoiceFooterText: "",
  InvoiceExportHeaderText: "", InvoiceExportFooterText: "",
  ...blankFlags(),
});

type Tab = "profile" | "modules" | "submodules" | "operators" | "mailsettings" | "changepass";

// â”€â”€ PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // dropdown data
  const [underUsers, setUnderUsers] = useState<{ UserID: string; UserName: string }[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [countries, setCountries] = useState<{ Country: string }[]>([]);
  const [states, setStates] = useState<{ State: string }[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [productionUnits, setProductionUnits] = useState<any[]>([]);

  // module auth
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [subModules, setSubModules] = useState<SubModuleRow[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<number[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>([]);

  // change password
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpSaving, setCpSaving] = useState(false);
  const [cpMsg, setCpMsg] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "User Master" : "User Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // â”€â”€ load list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadList = useCallback(() => {
    setLoading(true);
    apiFetch(`${BASE}/getuser`)
      .then(raw => setData(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.UserID) })) : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  // â”€â”€ load dropdown data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    apiFetch(`${BASE}/underuser`).then(r => setUnderUsers(Array.isArray(r) ? r : [])).catch(() => {});
    apiFetch(`${BASE}/userdesignation`).then(r => {
      if (Array.isArray(r)) setDesignations(r.map((x: any) => x.Designation).filter(Boolean));
    }).catch(() => {});
    apiFetch(`${BASE}/getcountry`).then(r => setCountries(Array.isArray(r) ? r : [])).catch(() => {});
    apiFetch(`${BASE}/getstate`).then(r => setStates(Array.isArray(r) ? r : [])).catch(() => {});
    apiFetch(`${BASE}/getbranch`).then(r => setBranches(Array.isArray(r) ? r : [])).catch(() => {});
    apiFetch(`${BASE}/getproductionunitlist`).then(r => setProductionUnits(Array.isArray(r) ? r : [])).catch(() => {});
    apiFetch(`${BASE}/useroperatorslist`).then(r => setOperators(Array.isArray(r) ? r : [])).catch(() => {});
    apiFetch(`${BASE}/getsegmentgrid`).then(r => setSegments(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // â”€â”€ load modules & sub-modules for a given userId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadModuleAuth = useCallback(async (userId: string | null) => {
    try {
      let mods: ModuleRow[];
      if (userId) {
        mods = unwrap(await (await fetch(`${BASE}/showdata?id=${userId}`, { headers: authHeaders() })).text());
      } else {
        mods = unwrap(await (await fetch(`${AUTH_BASE}/getallform`, { headers: authHeaders() })).text());
      }
      setModules(Array.isArray(mods) ? mods : []);
    } catch { setModules([]); }

    try {
      if (userId) {
        const sm = unwrap(await (await fetch(`${AUTH_BASE}/getsubmenudata?UserId=${userId}`, { headers: authHeaders() })).text());
        setSubModules(Array.isArray(sm) ? sm : []);
      } else {
        setSubModules([]);
      }
    } catch { setSubModules([]); }
  }, []);

  // â”€â”€ open add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setActiveTab("profile");
    setSubmitAttempted(false);
    setSelectedOperatorIds([]);
    setSelectedSegmentIds([]);
    setCpCurrent(""); setCpNew(""); setCpConfirm(""); setCpMsg("");
    loadModuleAuth(null);
    setView("form");
  };

  // â”€â”€ open edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openEdit = (row: UserRow) => {
    setEditing(row);
    setError("");
    setSubmitAttempted(false);
    setActiveTab("profile");
    setCpCurrent(""); setCpNew(""); setCpConfirm(""); setCpMsg("");

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
      smtpUserName: row.smtpUserName ?? "",
      smtpUserPassword: row.smtpUserPassword ?? "",
      RESMTPPassword: row.smtpUserPassword ?? "",
      smtpServer: row.smtpServer ?? "",
      smtpServerPort: row.smtpServerPort ?? "",
      smtpAuthenticate: row.smtpAuthenticate ?? "False",
      smtpUseSSL: row.smtpUseSSL ?? "False",
      Details: row.Details ?? "",
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
      IsAdmin: !!row.IsAdmin,
      IsCreateUser: !!row.IsCreateUser,
      IsExtraPaperIssue: !!row.IsExtraPaperIssue,
      IsUserCannotViewCostingDetail: !!row.IsUserCannotViewCostingDetail,
      IsHidden: !!row.IsHidden,
      ISChooseAnotherPaper: !!row.ISChooseAnotherPaper,
      IsEditableProductionDate: !!row.IsEditableProductionDate,
      AllowAccessTallyInterface: !!row.AllowAccessTallyInterface,
      AllowDuplicatePONoInSO: !!row.AllowDuplicatePONoInSO,
      AcceptSOLessThanEstimatedQty: !!row.AcceptSOLessThanEstimatedQty,
      CanDeleteQuotation: !!row.CanDeleteQuotation,
      CanReviseQuotation: !!row.CanReviseQuotation,
      CanCopyQuotation: !!row.CanCopyQuotation,
      CanPrintQuotation: !!row.CanPrintQuotation,
      CanReviewQuotation: !!row.CanReviewQuotation,
      CanSendQuotationForSO: !!row.CanSendQuotationForSO,
      CanRejectQuotation: !!row.CanRejectQuotation,
      CanCheckEstimatedJobDetails: !!row.CanCheckEstimatedJobDetails,
      CanCheckEstimatedDetailCosting: !!row.CanCheckEstimatedDetailCosting,
      CanChangePODate: !!row.CanChangePODate,
      CanEditPOQuantityAndRate: !!row.CanEditPOQuantityAndRate,
      CanEditProductionDate: !!row.CanEditProductionDate,
      CanPackMoreThanSOQty: !!row.CanPackMoreThanSOQty,
      CanCreateDirectPacking: !!row.CanCreateDirectPacking,
      CanEditApprovedCostInPriceApproval: !!row.CanEditApprovedCostInPriceApproval,
      CanEditRateInSO: !!row.CanEditRateInSO,
      CanChangeClientOnSO: !!row.CanChangeClientOnSO,
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

    // pre-select operators
    if (row.UserWiseOperatorsIDStr) {
      const ids = row.UserWiseOperatorsIDStr.split(",").map(Number).filter(Boolean);
      setSelectedOperatorIds(ids);
    } else {
      setSelectedOperatorIds([]);
    }
    setSelectedSegmentIds([]);

    loadModuleAuth(String(row.UserID));
    setView("form");
  };

  // â”€â”€ toggle module permission cell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toggleModPerm = (idx: number, field: keyof ModuleRow) => {
    setModules(prev => {
      const next = [...prev];
      const row = { ...next[idx] };
      // "All" row (idx === 0, ModuleHeadName === "All") â†’ apply to all
      if (idx === 0 && row.ModuleHeadName === "All") {
        const val = !row[field as keyof ModuleRow];
        return next.map(r => ({ ...r, [field]: val }));
      }
      (row as any)[field] = !(row as any)[field];
      // if CanView turned off, clear all others
      if (field === "CanView" && !(row as any).CanView) {
        row.CanSave = false; row.CanEdit = false; row.CanDelete = false;
        row.CanExport = false; row.CanPrint = false; row.CanCancel = false;
      }
      next[idx] = row;
      return next;
    });
  };

  const toggleSubPerm = (idx: number, field: keyof SubModuleRow) => {
    setSubModules(prev => {
      const next = [...prev];
      const row = { ...next[idx] };
      if (idx === 0 && (row as any).ModuleName === "All") {
        const val = !(row as any)[field];
        return next.map(r => ({ ...r, [field]: val }));
      }
      (row as any)[field] = !(row as any)[field];
      if (field === "CanView" && !(row as any).CanView) {
        row.CanSave = false; row.CanEdit = false; row.CanDelete = false;
        row.CanExport = false; row.CanPrint = false;
      }
      next[idx] = row;
      return next;
    });
  };

  // â”€â”€ save module auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveModuleAuth = async (userId: string) => {
    if (!modules.length) return;
    await fetch(`${AUTH_BASE}/insertfun`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ jsonObjectsRecordDetail: modules, User_ID: userId }),
    });
  };

  const saveSubModuleAuth = async (userId: string) => {
    if (!subModules.length) return;
    await fetch(`${AUTH_BASE}/savesubmodule`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ jsonObjectsRecordDetail: subModules, User_ID: userId }),
    });
  };

  // â”€â”€ validate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const validate = (): string => {
    if (!form.UserName.trim()) return "User Name is required.";
    if (!form.LoginUserName.trim()) return "Login User Name is required.";
    if (!editing && !form.Password.trim()) return "Password is required.";
    if (!editing && form.Password !== form.REPassword) return "Passwords do not match.";
    if (!form.ContactNo.trim()) return "Contact No. is required.";
    if (!form.UnderUserID) return "Under User is required.";
    if (!form.Designation.trim()) return "Designation is required.";
    return "";
  };

  // â”€â”€ save user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveUser = async () => {
    setSubmitAttempted(true);
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError("");

    // build operator allocation
    const operatorAlloc = selectedOperatorIds.map(id => {
      const op = operators.find(o => o.LedgerID === id);
      return { OperatorID: id, OperatorName: op?.LedgerName ?? "" };
    });
    // build segment allocation
    const segmentAlloc = selectedSegmentIds.map(id => {
      const sg = segments.find(s => s.SegmentID === id);
      return { SegmentID: id, SegmentName: sg?.SegmentName ?? "" };
    });

    // build user master object (remove internal fields)
    const userMasterObj = [{
      UserName: form.UserName, LoginUserName: form.LoginUserName,
      Password: form.Password, ContactNo: form.ContactNo,
      UnderUserID: form.UnderUserID, Designation: form.Designation,
      EmailID: form.EmailID, Country: form.Country, State: form.State, City: form.City,
      BranchID: form.BranchID || null, ProductionUnitID: form.ProductionUnitID || null,
      smtpUserName: form.smtpUserName, smtpUserPassword: form.smtpUserPassword,
      smtpServer: form.smtpServer, smtpServerPort: form.smtpServerPort,
      smtpAuthenticate: form.smtpAuthenticate, smtpUseSSL: form.smtpUseSSL,
      Details: form.Details,
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
            SegmentUserDataAllocation: segmentAlloc,
            TxtUserid: String(editing.UserID),
            FolderImgDel: "",
            ModuleID: "0",
            ModuleName: "ModuleName",
            OperatorAllocation: operatorAlloc,
          }),
        });
        result = unwrap(await res.text());
        if (result === "Success") {
          await saveModuleAuth(String(editing.UserID));
          await saveSubModuleAuth(String(editing.UserID));
        }
      } else {
        const res = await fetch(`${BASE}/saveuserdata`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataUserMaster: userMasterObj,
            OperatorAllocation: operatorAlloc,
            SegmentUserDataAllocation: segmentAlloc,
            SaveFlag: false,
            Userid: "",
            LoginUserName: form.LoginUserName,
          }),
        });
        result = unwrap(await res.text());
        // After save, get new userID and save module auth
        if (result === "Success") {
          try {
            const uidRaw = await apiFetch(`${BASE}/getuserid`);
            const uid = Array.isArray(uidRaw) && uidRaw.length > 0 ? String(uidRaw[0].UserID) : null;
            if (uid) {
              await saveModuleAuth(uid);
              await saveSubModuleAuth(uid);
            }
          } catch { /* module auth saved after user - non-critical */ }
        }
      }

      if (result === "Success") {
        loadList(); setView("list");
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

  // â”€â”€ delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ change password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const changePassword = async () => {
    if (!editing) return;
    if (!cpCurrent.trim()) { setCpMsg("Current password is required."); return; }
    if (!cpNew.trim()) { setCpMsg("New password is required."); return; }
    if (cpNew !== cpConfirm) { setCpMsg("New passwords do not match."); return; }
    setCpSaving(true); setCpMsg("");
    try {
      const res = await fetch(`${BASE}/updatepassword`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ UserID: Number(editing.UserID), CurrentPassword: cpCurrent, NewPassword: cpNew }),
      });
      const result = unwrap(await res.text());
      if (result === "Success") {
        setCpMsg("Password changed successfully.");
        setCpCurrent(""); setCpNew(""); setCpConfirm("");
      } else {
        setCpMsg(result || "Failed to change password.");
      }
    } catch (e: any) { setCpMsg("Error: " + e.message); }
    setCpSaving(false);
  };

  // â”€â”€ tabs config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tabs: { id: Tab; label: string; icon: React.ReactNode; editOnly?: boolean }[] = [
    { id: "profile", label: "User Profile", icon: <Users size={14} /> },
    { id: "modules", label: "Module Auth", icon: <Shield size={14} /> },
    { id: "submodules", label: "Sub-Module Auth", icon: <Shield size={14} /> },
    { id: "operators", label: "Employee Allocation", icon: <Users size={14} /> },
    { id: "mailsettings", label: "Mail Settings", icon: <Mail size={14} /> },
    { id: "changepass", label: "Change Password", icon: <Key size={14} />, editOnly: true },
  ];

  // â”€â”€ list columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const columns: Column<UserRow>[] = [
    { key: "UserID", header: "ID", sortable: true },
    { key: "UserName", header: "User Name", sortable: true },
    { key: "LoginUserName", header: "Login Name", sortable: true },
    { key: "Designation", header: "Designation", sortable: true },
    { key: "ContactNo", header: "Contact No", sortable: true },
    { key: "EmailID", header: "Email", sortable: true },
    { key: "BranchName", header: "Branch", sortable: true },
    { key: "ProductionUnitName", header: "Production Unit", sortable: true },
    {
      key: "IsAdmin", header: "Admin",
      render: r => r.IsAdmin
        ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Yes</span>
        : <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500">No</span>,
    },
  ];

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FORM VIEW
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (view === "form") {
    const visibleTabs = tabs.filter(t => !t.editOnly || editing);

    return (
      <div className="max-w-7xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? `Edit User â€” ${editing.UserName}` : "New User"}</h2>
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
          <div className="px-4 pt-4 pb-0 border-b border-gray-200 bg-gray-50/40 flex gap-1 flex-wrap">
            {editing && (
              <div className="w-full mb-2">
                <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                  ID: {editing.UserID}
                </span>
              </div>
            )}
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 rounded-t transition-colors ${
                  activeTab === t.id
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* â”€â”€ TAB: USER PROFILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeTab === "profile" && (
              <div className="space-y-8">
                {/* Basic Info */}
                <div>
                  <SectionTitle title="Basic Information" />
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    <Field label="User Name" required>
                      <input type="text" value={form.UserName} onChange={e => f("UserName", e.target.value)}
                        className={ic(submitAttempted && !form.UserName.trim())} placeholder="Full name" />
                    </Field>
                    <Field label="Login User Name" required>
                      <input type="text" value={form.LoginUserName} onChange={e => f("LoginUserName", e.target.value)}
                        className={ic(submitAttempted && !form.LoginUserName.trim())} placeholder="Login ID" />
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
                            <input type={showNewPwd ? "text" : "password"} value={form.REPassword}
                              onChange={e => f("REPassword", e.target.value)}
                              className={ic(submitAttempted && form.Password !== form.REPassword) + " pr-10"} />
                            <button type="button" onClick={() => setShowNewPwd(p => !p)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </Field>
                      </>
                    )}
                    <Field label="Contact No." required>
                      <input type="text" value={form.ContactNo}
                        onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); f("ContactNo", v); }}
                        maxLength={13} className={ic(submitAttempted && !form.ContactNo.trim())} placeholder="Mobile number" />
                    </Field>
                    <Field label="Under User" required>
                      <select value={form.UnderUserID} onChange={e => f("UnderUserID", e.target.value)}
                        className={ic(submitAttempted && !form.UnderUserID) === inputCls ? selectCls : ic(submitAttempted && !form.UnderUserID).replace(inputCls, selectCls)}>
                        <option value="">-- Select --</option>
                        {underUsers.map(u => <option key={u.UserID} value={u.UserID}>{u.UserName}</option>)}
                      </select>
                    </Field>
                    <Field label="Designation" required>
                      <input list="designations-list" type="text" value={form.Designation}
                        onChange={e => f("Designation", e.target.value)}
                        className={ic(submitAttempted && !form.Designation.trim())} placeholder="e.g. Manager" />
                      <datalist id="designations-list">
                        {designations.map(d => <option key={d} value={d} />)}
                      </datalist>
                    </Field>
                    <Field label="Email ID">
                      <input type="email" value={form.EmailID} onChange={e => f("EmailID", e.target.value)}
                        className={inputCls} placeholder="email@company.com" />
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
                      <input type="text" value={form.City} onChange={e => f("City", e.target.value)}
                        className={inputCls} placeholder="City" />
                    </Field>
                    <Field label="Branch">
                      <select value={form.BranchID} onChange={e => f("BranchID", e.target.value)} className={selectCls}>
                        <option value="">-- Select --</option>
                        {branches.map(b => <option key={b.BranchID} value={b.BranchID}>{b.BranchName}</option>)}
                      </select>
                    </Field>
                    <Field label="Production Unit" required>
                      <select value={form.ProductionUnitID} onChange={e => f("ProductionUnitID", e.target.value)} className={selectCls}>
                        <option value="">-- Select --</option>
                        {productionUnits.map(p => <option key={p.ProductionUnitID} value={p.ProductionUnitID}>{p.ProductionUnitName}</option>)}
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Details">
                        <textarea value={form.Details} onChange={e => f("Details", e.target.value)} rows={2}
                          className={inputCls} placeholder="Additional notes..." />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* General Flags */}
                <div>
                  <SectionTitle title="General Permissions" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <Chk id="IsAdmin" label="Can have administrative rights" checked={form.IsAdmin} onChange={v => f("IsAdmin", v)} />
                    <Chk id="AllowAccessTallyInterface" label="Can Access Integration Interface" checked={form.AllowAccessTallyInterface} onChange={v => f("AllowAccessTallyInterface", v)} />
                    <Chk id="IsUserCannotViewCostingDetail" label="Cannot View Product Costing Detail" checked={form.IsUserCannotViewCostingDetail} onChange={v => f("IsUserCannotViewCostingDetail", v)} />
                    <Chk id="AllowDuplicatePONoInSO" label="Allow Duplicate P.O. No. In S.O." checked={form.AllowDuplicatePONoInSO} onChange={v => f("AllowDuplicatePONoInSO", v)} />
                    <Chk id="AcceptSOLessThanEstimatedQty" label="Accept S.O. less than Estimated Qty" checked={form.AcceptSOLessThanEstimatedQty} onChange={v => f("AcceptSOLessThanEstimatedQty", v)} />
                    <Chk id="CanEditRateInSO" label="Can Edit Rate In S.O." checked={form.CanEditRateInSO} onChange={v => f("CanEditRateInSO", v)} />
                    <Chk id="CanChangeClientOnSO" label="Can Change Client On S.O." checked={form.CanChangeClientOnSO} onChange={v => f("CanChangeClientOnSO", v)} />
                    <Chk id="CanAccessMultipleBranchData" label="Can Access Multiple Branch Data" checked={form.CanAccessMultipleBranchData} onChange={v => f("CanAccessMultipleBranchData", v)} />
                    <Chk id="CanEditMaterialCostParameter" label="Can Edit Material Cost Parameter" checked={form.CanEditMaterialCostParameter} onChange={v => f("CanEditMaterialCostParameter", v)} />
                    <Chk id="CanUpdateSODetails" label="Can Update SO Details" checked={form.CanUpdateSODetails} onChange={v => f("CanUpdateSODetails", v)} />
                    <Chk id="IsChallanBlockFeatureRequired" label="Can Block Challan" checked={form.IsChallanBlockFeatureRequired} onChange={v => f("IsChallanBlockFeatureRequired", v)} />
                    <Chk id="IsInvoiceBlockFeatureRequired" label="Can Block In Invoice" checked={form.IsInvoiceBlockFeatureRequired} onChange={v => f("IsInvoiceBlockFeatureRequired", v)} />
                    <Chk id="CanIReplanthePWOorProductCatalog" label="Can Replan PWO / Catalog" checked={form.CanIReplanthePWOorProductCatalog} onChange={v => f("CanIReplanthePWOorProductCatalog", v)} />
                    <Chk id="CanAccessMultipleProductionUnitData" label="Can Access Multiple Production Unit Data" checked={form.CanAccessMultipleProductionUnitData} onChange={v => f("CanAccessMultipleProductionUnitData", v)} />
                    <Chk id="CanAddAdditionalProcessesInPWO" label="Can Add Additional Processes In PWO" checked={form.CanAddAdditionalProcessesInPWO} onChange={v => f("CanAddAdditionalProcessesInPWO", v)} />
                    <Chk id="IsEventOTP" label="Is Event OTP" checked={form.IsEventOTP} onChange={v => f("IsEventOTP", v)} />
                    <Chk id="IsCreateUser" label="Is Create User" checked={form.IsCreateUser} onChange={v => f("IsCreateUser", v)} />
                    <Chk id="IsExtraPaperIssue" label="Is Extra Paper Issue" checked={form.IsExtraPaperIssue} onChange={v => f("IsExtraPaperIssue", v)} />
                    <Chk id="CanReceiveExcessMaterial" label="Can Receive Excess Material" checked={form.CanReceiveExcessMaterial} onChange={v => f("CanReceiveExcessMaterial", v)} />
                    <Chk id="ISChooseAnotherPaper" label="Can Choose Another Paper" checked={form.ISChooseAnotherPaper} onChange={v => f("ISChooseAnotherPaper", v)} />
                    <Chk id="IsCreateDirectInvoice" label="Can Create Direct Invoice" checked={form.IsCreateDirectInvoice} onChange={v => f("IsCreateDirectInvoice", v)} />
                    <Chk id="IsUpdateOutSourceInvoiceQuantity" label="Update OutSource Invoice Quantity" checked={form.IsUpdateOutSourceInvoiceQuantity} onChange={v => f("IsUpdateOutSourceInvoiceQuantity", v)} />
                    <Chk id="IsUserViewOtherQuotation" label="Can View Other's Quotation" checked={form.IsUserViewOtherQuotation} onChange={v => f("IsUserViewOtherQuotation", v)} />
                  </div>
                </div>

                {/* Estimation Flags */}
                <div>
                  <SectionTitle title="Estimation Permissions" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <Chk id="CanDeleteQuotation" label="Can Delete Quotation" checked={form.CanDeleteQuotation} onChange={v => f("CanDeleteQuotation", v)} />
                    <Chk id="CanReviseQuotation" label="Can Revise Quotation" checked={form.CanReviseQuotation} onChange={v => f("CanReviseQuotation", v)} />
                    <Chk id="CanCopyQuotation" label="Can Copy Quotation" checked={form.CanCopyQuotation} onChange={v => f("CanCopyQuotation", v)} />
                    <Chk id="CanPrintQuotation" label="Can Print Quotation" checked={form.CanPrintQuotation} onChange={v => f("CanPrintQuotation", v)} />
                    <Chk id="CanReviewQuotation" label="Can Review Quotation" checked={form.CanReviewQuotation} onChange={v => f("CanReviewQuotation", v)} />
                    <Chk id="CanSendQuotationForSO" label="Can Send Quotation For S.O." checked={form.CanSendQuotationForSO} onChange={v => f("CanSendQuotationForSO", v)} />
                    <Chk id="CanRejectQuotation" label="Can Reject Quotation" checked={form.CanRejectQuotation} onChange={v => f("CanRejectQuotation", v)} />
                    <Chk id="CanCheckEstimatedJobDetails" label="Can Check Estimated Job Details" checked={form.CanCheckEstimatedJobDetails} onChange={v => f("CanCheckEstimatedJobDetails", v)} />
                    <Chk id="CanCheckEstimatedDetailCosting" label="Can Check Estimated Detail Costing" checked={form.CanCheckEstimatedDetailCosting} onChange={v => f("CanCheckEstimatedDetailCosting", v)} />
                    <Chk id="CanChangePODate" label="Can Change P.O. Date" checked={form.CanChangePODate} onChange={v => f("CanChangePODate", v)} />
                    <Chk id="CanEditPOQuantityAndRate" label="Can Edit P.O. Qty & Rate" checked={form.CanEditPOQuantityAndRate} onChange={v => f("CanEditPOQuantityAndRate", v)} />
                    <Chk id="CanEditProductionDate" label="Can Edit Production Date" checked={form.CanEditProductionDate} onChange={v => f("CanEditProductionDate", v)} />
                    <Chk id="CanPackMoreThanSOQty" label="Can Pack More Than S.O. Qty" checked={form.CanPackMoreThanSOQty} onChange={v => f("CanPackMoreThanSOQty", v)} />
                    <Chk id="CanCreateDirectPacking" label="Can Create Direct Packing" checked={form.CanCreateDirectPacking} onChange={v => f("CanCreateDirectPacking", v)} />
                    <Chk id="CanEditApprovedCostInPriceApproval" label="Can Edit Approved Cost In Price Approval" checked={form.CanEditApprovedCostInPriceApproval} onChange={v => f("CanEditApprovedCostInPriceApproval", v)} />
                  </div>
                </div>

                {/* Production Flags */}
                <div>
                  <SectionTitle title="Production Permissions" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <Chk id="IsSaveEditClosedJobProcess" label="Save/Edit Closed Job Process" checked={form.IsSaveEditClosedJobProcess} onChange={v => f("IsSaveEditClosedJobProcess", v)} />
                    <Chk id="IsDeleteProductionEntry" label="Can Delete Production Entry" checked={form.IsDeleteProductionEntry} onChange={v => f("IsDeleteProductionEntry", v)} />
                    <Chk id="IsModifyScheduleProcess" label="Can Modify Schedule Process" checked={form.IsModifyScheduleProcess} onChange={v => f("IsModifyScheduleProcess", v)} />
                    <Chk id="IsEditableProductionDate" label="Is Editable Production Date" checked={form.IsEditableProductionDate} onChange={v => f("IsEditableProductionDate", v)} />
                    <Chk id="IsHidden" label="Is Hidden" checked={form.IsHidden} onChange={v => f("IsHidden", v)} />
                  </div>
                </div>
              </div>
            )}

            {/* â”€â”€ TAB: MODULE AUTHENTICATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeTab === "modules" && (
              <div>
                <SectionTitle title="Module Authentication" />
                {modules.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">No modules available. Load a user to see permissions.</p>
                  : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-blue-700 text-white">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold w-32">Group</th>
                            <th className="px-3 py-2 text-left font-semibold">Module</th>
                            {(["CanView","CanSave","CanEdit","CanDelete","CanExport","CanPrint","CanCancel"] as (keyof ModuleRow)[]).map(p => (
                              <th key={p} className="px-2 py-2 text-center font-semibold w-16">{p.replace("Can","")}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {modules.map((mod, idx) => (
                            <tr key={`mod-${idx}`}
                              className={idx % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/60 hover:bg-blue-50/30"}>
                              <td className="px-3 py-1.5 text-gray-500 font-medium">{mod.ModuleHeadName}</td>
                              <td className="px-3 py-1.5 text-gray-800">{mod.ModuleDisplayName}</td>
                              {(["CanView","CanSave","CanEdit","CanDelete","CanExport","CanPrint","CanCancel"] as (keyof ModuleRow)[]).map(p => (
                                <td key={p} className="px-2 py-1.5 text-center">
                                  <input type="checkbox" checked={!!mod[p]}
                                    disabled={p !== "CanView" && !mod.CanView}
                                    onChange={() => toggleModPerm(idx, p)}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            )}

            {/* â”€â”€ TAB: SUB-MODULE AUTHENTICATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeTab === "submodules" && (
              <div>
                <SectionTitle title="Sub-Module Authentication (Item / Ledger Groups)" />
                {subModules.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">No sub-module data. Select an existing user to manage sub-module rights.</p>
                  : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-blue-700 text-white">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Module</th>
                            <th className="px-3 py-2 text-left font-semibold w-20">Type</th>
                            {(["CanView","CanSave","CanEdit","CanDelete","CanExport","CanPrint"] as (keyof SubModuleRow)[]).map(p => (
                              <th key={p} className="px-2 py-2 text-center font-semibold w-16">{p.replace("Can","")}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subModules.map((sm, idx) => (
                            <tr key={`sub-${idx}`}
                              className={idx % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/60 hover:bg-blue-50/30"}>
                              <td className="px-3 py-1.5 text-gray-800">{sm.ModuleName}</td>
                              <td className="px-3 py-1.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${
                                  sm.ModuleType === "Items" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                }`}>{sm.ModuleType}</span>
                              </td>
                              {(["CanView","CanSave","CanEdit","CanDelete","CanExport","CanPrint"] as (keyof SubModuleRow)[]).map(p => (
                                <td key={p} className="px-2 py-1.5 text-center">
                                  <input type="checkbox" checked={!!sm[p]}
                                    disabled={p !== "CanView" && !sm.CanView}
                                    onChange={() => toggleSubPerm(idx, p)}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            )}

            {/* â”€â”€ TAB: EMPLOYEE ALLOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeTab === "operators" && (
              <div>
                <SectionTitle title="Employee / Operator Allocation" />
                <p className="text-xs text-gray-400 mb-3">Select employees to allocate to this user:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {operators.map(op => (
                    <label key={op.LedgerID} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1.5 rounded hover:bg-blue-50">
                      <input type="checkbox"
                        checked={selectedOperatorIds.includes(op.LedgerID)}
                        onChange={e => setSelectedOperatorIds(prev =>
                          e.target.checked ? [...prev, op.LedgerID] : prev.filter(id => id !== op.LedgerID)
                        )}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                      {op.LedgerName}
                    </label>
                  ))}
                  {operators.length === 0 && (
                    <p className="col-span-full text-center text-gray-400 py-4">No operators found.</p>
                  )}
                </div>
                <p className="mt-2 text-xs text-blue-600 font-medium">{selectedOperatorIds.length} selected</p>
              </div>
            )}

            {/* â”€â”€ TAB: MAIL SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeTab === "mailsettings" && (
              <div className="space-y-8">
                {/* SMTP Settings */}
                <div>
                  <SectionTitle title="SMTP Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    <Field label="SMTP User Name">
                      <input type="text" value={form.smtpUserName} onChange={e => f("smtpUserName", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="SMTP Password">
                      <input type="password" value={form.smtpUserPassword} onChange={e => f("smtpUserPassword", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Re-Type SMTP Password">
                      <input type="password" value={form.RESMTPPassword} onChange={e => f("RESMTPPassword", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="SMTP Server">
                      <input type="text" value={form.smtpServer} onChange={e => f("smtpServer", e.target.value)} className={inputCls} placeholder="smtp.gmail.com" />
                    </Field>
                    <Field label="SMTP Server Port">
                      <input type="text" value={form.smtpServerPort} onChange={e => f("smtpServerPort", e.target.value)} className={inputCls} placeholder="587" />
                    </Field>
                    <Field label="Authenticate">
                      <select value={form.smtpAuthenticate} onChange={e => f("smtpAuthenticate", e.target.value)} className={selectCls}>
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    </Field>
                    <Field label="Use SSL">
                      <select value={form.smtpUseSSL} onChange={e => f("smtpUseSSL", e.target.value)} className={selectCls}>
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    </Field>
                  </div>
                </div>

                {/* Quote Mail Settings */}
                <div>
                  <SectionTitle title="Quote Mail Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Email Message">
                      <textarea rows={3} value={form.EmailMessage} onChange={e => f("EmailMessage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Header Text">
                      <textarea rows={3} value={form.HeaderText} onChange={e => f("HeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Footer Text">
                      <textarea rows={3} value={form.FooterText} onChange={e => f("FooterText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Export Header Text">
                      <textarea rows={3} value={form.ExportHeaderText} onChange={e => f("ExportHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Export Footer Text">
                      <textarea rows={3} value={form.ExportFooterText} onChange={e => f("ExportFooterText", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>

                {/* PO Mail Settings */}
                <div>
                  <SectionTitle title="PO Mail Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="PO Email Message">
                      <textarea rows={3} value={form.POEmailMessage} onChange={e => f("POEmailMessage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="PO Header Text">
                      <textarea rows={3} value={form.POHeaderText} onChange={e => f("POHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="PO Footer Text">
                      <textarea rows={3} value={form.POFooterText} onChange={e => f("POFooterText", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>

                {/* Invoice Mail Settings */}
                <div>
                  <SectionTitle title="Invoice Mail Settings" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Invoice Email Message">
                      <textarea rows={3} value={form.InvoiceEmailMessage} onChange={e => f("InvoiceEmailMessage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Header Text">
                      <textarea rows={3} value={form.InvoiceHeaderText} onChange={e => f("InvoiceHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Footer Text">
                      <textarea rows={3} value={form.InvoiceFooterText} onChange={e => f("InvoiceFooterText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Export Header Text">
                      <textarea rows={3} value={form.InvoiceExportHeaderText} onChange={e => f("InvoiceExportHeaderText", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Invoice Export Footer Text">
                      <textarea rows={3} value={form.InvoiceExportFooterText} onChange={e => f("InvoiceExportFooterText", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* â”€â”€ TAB: CHANGE PASSWORD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeTab === "changepass" && editing && (
              <div className="max-w-md">
                <SectionTitle title="Change Password" />
                <div className="space-y-4">
                  <Field label="Current Password">
                    <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="New Password">
                    <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Confirm New Password">
                    <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} className={inputCls} />
                  </Field>
                  {cpMsg && (
                    <p className={`text-sm font-medium ${cpMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{cpMsg}</p>
                  )}
                  <button onClick={changePassword} disabled={cpSaving}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {cpSaving ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                    Change Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LIST VIEW
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
