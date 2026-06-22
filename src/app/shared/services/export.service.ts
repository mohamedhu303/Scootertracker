import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  /**
   * Export data array to CSV file
   */
  exportToCSV(data: any[], filename: string, headers?: { key: string; label: string }[]) {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    // Auto-detect headers if not provided
    if (!headers) {
      headers = Object.keys(data[0]).map(key => ({
        key,
        label: this.formatLabel(key)
      }));
    }

    // Build CSV content
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map(h => this.escapeCSV(h.label)).join(','));

    // Data rows
    data.forEach(item => {
      const row = headers!.map(h => {
        const value = this.getNestedValue(item, h.key);
        return this.escapeCSV(value);
      });
      csvRows.push(row.join(','));
    });

    // Add BOM for Excel UTF-8 support
    const csvContent = '\uFEFF' + csvRows.join('\n');

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  /**
   * Export data to JSON file
   */
  exportToJSON(data: any[], filename: string) {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const jsonContent = JSON.stringify(data, null, 2);
    this.downloadFile(jsonContent, `${filename}.json`, 'application/json');
  }

  /**
   * Print table or content
   */
  printContent(title: string, htmlContent: string) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            body { padding: 24px; color: #1e293b; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .subtitle { color: #64748b; margin-bottom: 20px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8fafc; padding: 10px; text-align: left; font-size: 12px;
                 text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
            td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            tr:hover { background: #f8fafc; }
            .footer { margin-top: 24px; text-align: center; color: #94a3b8; font-size: 11px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
          ${htmlContent}
          <div class="footer">© ${new Date().getFullYear()} ScooterAdmin Dashboard</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  /**
   * Print data as table
   */
  printTable(title: string, data: any[], headers: { key: string; label: string }[]) {
    if (!data || data.length === 0) return;

    let tableHtml = '<table><thead><tr>';
    headers.forEach(h => tableHtml += `<th>${h.label}</th>`);
    tableHtml += '</tr></thead><tbody>';

    data.forEach(item => {
      tableHtml += '<tr>';
      headers.forEach(h => {
        const value = this.getNestedValue(item, h.key);
        tableHtml += `<td>${value ?? '-'}</td>`;
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    this.printContent(title, tableHtml);
  }

  // ===== Helpers =====

  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);

    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  private getNestedValue(obj: any, key: string): any {
    return key.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}