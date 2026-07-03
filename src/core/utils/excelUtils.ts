import * as ExcelJS from 'exceljs';

// ═══════════════════════════════════════════════════════════════
// Excel Utility Functions — Single Source of Truth
// ═══════════════════════════════════════════════════════════════
// Extracted from ExcelReader.ts and ResultWriter.ts to eliminate
// code duplication. All Excel cell reading should use these.
// ═══════════════════════════════════════════════════════════════

/**
 * Lấy text từ ExcelJS Cell, xử lý merged cell, null value, formula result.
 * Đây là hàm duy nhất toàn codebase để đọc cell text từ Cell object.
 */
export function getCellTextFromCell(cell: ExcelJS.Cell | null | undefined): string {
  if (!cell) return '';
  try {
    if (cell.type === ExcelJS.ValueType.Merge) {
      const val = cell.value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        if ('result' in val) return String((val as any).result || '').trim();
        if ('text' in val) return String((val as any).text || '').trim();
        return '';
      }
      return String(val).trim();
    }
    const txt = cell.text;
    return txt ? txt.trim() : '';
  } catch (e) {
    try {
      const val = cell.value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        if ('result' in val) return String((val as any).result || '').trim();
        if ('text' in val) return String((val as any).text || '').trim();
        return '';
      }
      return String(val).trim();
    } catch {
      return '';
    }
  }
}

/**
 * Lấy text từ ExcelJS Row theo column index.
 * Wrapper tiện lợi cho getCellTextFromCell.
 * @returns empty string nếu index = -1 (cột không tồn tại)
 */
export function getCellText(row: ExcelJS.Row, index: number): string {
  if (index === -1) return '';
  return getCellTextFromCell(row.getCell(index));
}

/**
 * Format header cell cho các cột output [o]_ trong ResultWriter.
 * Style: Segoe UI 11pt bold, white text, dark blue background.
 */
export function formatNewHeaderCell(cell: ExcelJS.Cell): void {
  cell.font = {
    name: 'Segoe UI',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }
  };
  cell.alignment = {
    vertical: 'top',
    horizontal: 'left',
    wrapText: true
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
  };
}
