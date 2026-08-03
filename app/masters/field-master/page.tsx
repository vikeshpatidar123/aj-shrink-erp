"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, List, Check } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  getFields,
  getFieldValues,
  addFieldValue,
  deleteFieldValue,
  FieldValueRow,
} from "@/services/fieldMasterService";

// Local helper UI (same pattern as other master pages)
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

// Display-only renames — the underlying FieldName string (used for all API
// calls) is unchanged; only what the user sees here is relabeled, to match
// the renamed labels used in Artwork Management.
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  "Standard Pack Sizes": "SKU Size",
  "SKU Types": "Special Specification",
  "Bottle Type": "Material Type",
};
const displayFieldName = (f: string) => FIELD_DISPLAY_NAMES[f] ?? f;

// Page
export default function FieldMasterPage() {
  // State
  const [fields, setFields] = useState<string[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);

  const [selectedField, setSelectedField] = useState("");
  const [gridData, setGridData] = useState<FieldValueRow[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load field list once
  useEffect(() => {
    setLoadingFields(true);
    getFields()
      .then((f) => setFields(f))
      .finally(() => setLoadingFields(false));
  }, []);

  // Load values whenever selected field changes
  const loadValues = useCallback(async (fieldName: string) => {
    if (!fieldName) { setGridData([]); return; }
    setLoadingGrid(true);
    setError("");
    setSuccessMsg("");
    try {
      const rows = await getFieldValues(fieldName);
      setGridData(rows);
    } catch {
      setGridData([]);
    } finally {
      setLoadingGrid(false);
    }
  }, []);

  useEffect(() => {
    loadValues(selectedField);
  }, [selectedField, loadValues]);

  // Add value
  const handleAdd = async () => {
    setSubmitAttempted(true);
    setError("");
    setSuccessMsg("");

    if (!selectedField) {
      setError("Please select a field first.");
      return;
    }
    if (!newValue.trim()) {
      setError("Value cannot be empty.");
      return;
    }

    setAdding(true);
    try {
      const result = await addFieldValue(selectedField, newValue.trim());
      if (result === "Success") {
        setNewValue("");
        setSubmitAttempted(false);
        setSuccessMsg(`"${newValue.trim()}" added successfully.`);
        await loadValues(selectedField);
      } else if (result === "Exist") {
        setError(`"${newValue.trim()}" already exists in ${displayFieldName(selectedField)}.`);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    } finally {
      setAdding(false);
    }
  };

  // Delete value
  const handleDelete = async (row: FieldValueRow) => {
    if (!confirm(`Delete "${row.FieldValue}" from ${displayFieldName(row.FieldName)}?`)) return;
    setError("");
    setSuccessMsg("");
    try {
      await deleteFieldValue(row.FieldName, row.FieldValue);
      setSuccessMsg(`"${row.FieldValue}" deleted.`);
      await loadValues(selectedField);
    } catch (e: any) {
      setError("Delete failed: " + e.message);
    }
  };

  // Columns
  const columns: Column<FieldValueRow>[] = [
    {
      key: "SortOrder",
      header: "#",
      sortable: true,
      render: (r) => (
        <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 text-gray-600">
          {r.SortOrder}
        </span>
      ),
    },
    {
      key: "FieldValue",
      header: "Value",
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-gray-800">{r.FieldValue}</span>
      ),
    },
    {
      key: "FieldName",
      header: "Field",
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          {displayFieldName(r.FieldName)}
        </span>
      ),
    },
  ];

  // Render
  return (
    <div className="w-full space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Field Master</h2>
          <p className="text-sm text-gray-500">
            Manage dropdown values used across all master modules
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
          <List size={14} className="text-blue-500" />
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            {gridData.length} {gridData.length === 1 ? "value" : "values"}
            {selectedField ? ` · ${displayFieldName(selectedField)}` : ""}
          </span>
        </div>
      </div>

      {/* Error / Success Banners */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
          <Check size={15} /> {successMsg}
        </div>
      )}

      {/* Top Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-8">
          <div>
            <SectionTitle title="Field Configuration" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Field Selector */}
              {loadingFields ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Loading fields...
                </div>
              ) : (
                <Select label="Select Field"
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value);
                    setNewValue("");
                    setSubmitAttempted(false);
                    setError("");
                    setSuccessMsg("");
                  }}
                  options={[{ value: "", label: "-- Select a Field --" }, ...fields.map(f => ({ value: f, label: displayFieldName(f) }))]}
                  error={submitAttempted && !selectedField ? "Required" : undefined} />
              )}

              {/* New Value Input */}
              <Input label="New Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={
                  selectedField
                    ? `Enter new value for "${displayFieldName(selectedField)}"...`
                    : "Select a field first"
                }
                disabled={!selectedField}
                error={submitAttempted && !newValue.trim() ? "Required" : undefined} />

              {/* Add Button */}
              <div className="flex items-end">
                <Button variant="primary" loading={adding} icon={<Plus size={16}/>}
                  onClick={handleAdd} disabled={!selectedField}>
                  Add Value
                </Button>
              </div>
            </div>
          </div>

          {/* Field info strip */}
          {selectedField && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Viewing:
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                {displayFieldName(selectedField)}
              </span>
              <span className="text-xs text-gray-400">
                {loadingGrid ? "Loading..." : `${gridData.length} values configured`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {!selectedField ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <List size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              No field selected
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Select a field above to view and manage its values.
            </p>
          </div>
        ) : loadingGrid ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" />
            Loading values...
          </div>
        ) : (
          <DataTable
            data={gridData}
            columns={columns}
            searchKeys={["FieldValue", "FieldName"]}
            actions={(row) => (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={() => handleDelete(row)}
                >
                  Delete
                </Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
