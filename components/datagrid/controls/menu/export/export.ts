import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Export data to CSV format
 */
export function exportToCSV<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `${filename}.csv`)
  } catch (error) {
    console.error('❌ [DataGrid Export] CSV export failed:', error)
    throw error
  }
}

/**
 * Export data to Excel format
 */
export async function exportToExcel<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data')

    if (data.length > 0) {
      // Add headers
      const headers = Object.keys(data[0] as any)
      worksheet.addRow(headers)

      // Style headers
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      }
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

      // Add data rows
      data.forEach((item) => {
        const row = headers.map(header => (item as any)[header])
        worksheet.addRow(row)
      })

      // Auto-size columns
      worksheet.columns.forEach((column, index) => {
        let maxLength = headers[index]?.length || 10

        data.forEach((item) => {
          const value = (item as any)[headers[index]]
          if (value) {
            maxLength = Math.max(maxLength, value.toString().length)
          }
        })

        column.width = Math.min(maxLength + 2, 50)
      })
    }

    // Save file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    saveAs(blob, `${filename}.xlsx`)
  } catch (error) {
    console.error('❌ [DataGrid Export] Excel export failed:', error)
    throw error
  }
}

/**
 * Export data to PDF format
 */
export function exportToPDF<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(16)
    doc.text('Data Export', 14, 22)

    // Add timestamp
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)

    // Extract headers and rows
    if (data.length > 0) {
      const headers = Object.keys(data[0] as any)
      const rows = data.map(item => headers.map(header => (item as any)[header]))

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 40,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246], // Blue
          textColor: 255,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {},
        margin: { top: 40 },
      })
    }

    doc.save(`${filename}.pdf`)
  } catch (error) {
    console.error('❌ [DataGrid Export] PDF export failed:', error)
    throw error
  }
}

/**
 * Export data to JSON format
 */
export function exportToJSON<TData>(data: TData[], filename: string = 'data-export') {
  try {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    saveAs(blob, `${filename}.json`)
  } catch (error) {
    console.error('❌ [DataGrid Export] JSON export failed:', error)
    throw error
  }
}

/**
 * Unified export function that handles all formats
 */
export async function exportData<TData>(
  data: TData[],
  format: 'excel' | 'csv' | 'pdf' | 'json',
  filename: string = 'data-export'
) {
  switch (format) {
    case 'excel':
      return await exportToExcel(data, filename)
    case 'csv':
      return exportToCSV(data, filename)
    case 'pdf':
      return exportToPDF(data, filename)
    case 'json':
      return exportToJSON(data, filename)
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
