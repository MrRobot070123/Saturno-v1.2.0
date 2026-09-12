import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportColumn {
  header: string;
  key: string;
  // Peso relativo de ancho (columnas con más texto, como descripciones u
  // observaciones, deben recibir más espacio que "Estado" o "Prioridad").
  width?: number;
}

// Paleta de marca SATURNO, igual a la del frontend (styles.scss), para que
// los reportes descargados se vean consistentes con la aplicación.
const BRAND_PRIMARY = '019CFF';
const BRAND_PRIMARY_DARK = '01133A';
const BRAND_ROW_ALT = 'F2F8FF';

function resolveLogoPath(): string | null {
  const candidate = path.join(process.cwd(), 'assets', 'logo-saturno.png');
  return fs.existsSync(candidate) ? candidate : null;
}

// Serializador CSV propio (sin dependencias externas): evita problemas de
// tipos de TypeScript de librerías de terceros y mantiene el control total
// del formato (comillas, escape de comas/saltos de línea, BOM para acentos).
function toCsv(columns: ExportColumn[], rows: any[]): string {
  const escapeCell = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  return [header, ...lines].join('\n');
}

// Toda la generación de archivos ocurre en el servidor (regla #22): el
// navegador solo recibe el archivo final vía streaming, sin bloquearse
// procesando miles de filas en JavaScript del cliente.
@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  exportCsv(res: Response, filename: string, columns: ExportColumn[], rows: any[]) {
    const csv = toCsv(columns, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send('\uFEFF' + csv); // BOM para correcta apertura de acentos en Excel
  }

  async exportExcel(res: Response, filename: string, columns: ExportColumn[], rows: any[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SATURNO · Quejas y Solicitudes';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Reporte', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    const totalCols = columns.length;

    // ---------- Encabezado de marca (logo + título) ----------
    const logoPath = resolveLogoPath();
    if (logoPath) {
      try {
        const imageId = workbook.addImage({ filename: logoPath, extension: 'png' });
        sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } });
      } catch (err) {
        this.logger.warn(`No se pudo incrustar el logo en el Excel: ${(err as Error).message}`);
      }
    }

    sheet.mergeCells(1, 2, 1, totalCols);
    const titleCell = sheet.getCell(1, 2);
    titleCell.value = 'SATURNO · Reporte de casos';
    titleCell.font = { bold: true, size: 16, color: { argb: `FF${BRAND_PRIMARY_DARK}` } };

    sheet.mergeCells(2, 2, 2, totalCols);
    const subtitleCell = sheet.getCell(2, 2);
    subtitleCell.value = `Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (hora Colombia)`;
    subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 16;
    sheet.getRow(3).height = 6; // separador

    // ---------- Encabezado de columnas (fila 4) ----------
    const headerRow = sheet.getRow(4);
    columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_PRIMARY_DARK}` } };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    headerRow.height = 20;
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: totalCols } };

    columns.forEach((c, i) => {
      sheet.getColumn(i + 1).width = c.width ?? 22;
    });

    // ---------- Filas de datos (con franjas alternadas y bordes) ----------
    rows.forEach((r, idx) => {
      const row = sheet.addRow(columns.map((c) => r[c.key] ?? ''));
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_ROW_ALT}` } };
        }
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  exportPdf(res: Response, title: string, filename: string, columns: ExportColumn[], rows: any[]) {
    const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);

    const margin = 30;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - margin * 2;
    const logoPath = resolveLogoPath();

    const totalWeight = columns.reduce((sum, c) => sum + (c.width ?? 1), 0);
    const colWidths = columns.map((c) => ((c.width ?? 1) / totalWeight) * contentWidth);

    // Encabezado de marca, repetido en cada página nueva.
    const drawBrandHeader = () => {
      doc.rect(0, 0, pageWidth, 64).fill(`#${BRAND_PRIMARY_DARK}`);
      if (logoPath) {
        try {
          doc.image(logoPath, margin, 10, { width: 44, height: 44 });
        } catch {
          /* si la imagen no puede incrustarse, se omite sin romper el PDF */
        }
      }
      const textX = logoPath ? margin + 56 : margin;
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text(title, textX, 14);
      doc
        .fillColor('#BFE3FF')
        .fontSize(8)
        .font('Helvetica')
        .text(
          `Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (hora Colombia) · SATURNO · Quejas y Solicitudes`,
          textX,
          36,
        );
      return 78; // y donde continúa el contenido
    };

    const drawTableHeader = (y: number) => {
      doc.rect(margin, y, contentWidth, 22).fill(`#${BRAND_PRIMARY}`);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
      let x = margin;
      columns.forEach((c, i) => {
        doc.text(c.header, x + 6, y + 6, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });
      return y + 22;
    };

    const footerHeight = 26;
    let y = drawBrandHeader();
    y = drawTableHeader(y);

    doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');

    rows.forEach((row, idx) => {
      // Altura de fila estimada según el texto más largo de la fila (para
      // que descripciones/observaciones largas no se corten ni se encimen).
      const cellTexts = columns.map((c) => String(row[c.key] ?? ''));
      const rowHeight = Math.max(
        18,
        ...cellTexts.map((t, i) => doc.heightOfString(t, { width: colWidths[i] - 8 }) + 8),
      );

      if (y + rowHeight > pageHeight - footerHeight) {
        doc.addPage();
        y = drawBrandHeader();
        y = drawTableHeader(y);
        doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
      }

      if (idx % 2 === 1) {
        doc.rect(margin, y, contentWidth, rowHeight).fill(`#${BRAND_ROW_ALT}`);
        doc.fillColor('#1e293b');
      }

      let x = margin;
      columns.forEach((c, i) => {
        doc.text(cellTexts[i], x + 6, y + 5, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });

      doc
        .moveTo(margin, y + rowHeight)
        .lineTo(margin + contentWidth, y + rowHeight)
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .stroke();

      y += rowHeight;
    });

    // Pie de página con numeración, en todas las páginas generadas.
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(
          `SATURNO · Quejas y Solicitudes — Página ${i + 1} de ${pageRange.count}`,
          margin,
          pageHeight - 20,
          { width: contentWidth, align: 'center' },
        );
    }

    doc.end();
  }
}
