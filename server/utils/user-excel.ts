import AdmZip from 'adm-zip';

/**
 * A real Office Open XML spreadsheet. Cells are emitted as inline strings,
 * never formulas, so untrusted display names such as "=HYPERLINK(...)" cannot
 * become executable spreadsheet formulas.
 */
export type ExportedUserRow = {
  name: string;
  mobile: string;
  studentNumber: string;
  roles: string;
  verified: string;
  permissions: string;
};

const xmlEscape = (input: string): string =>
  input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function excelColumn(index: number): string {
  let result = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  }
  return result;
}

export function userDirectoryXlsx(rows: readonly ExportedUserRow[]): Buffer {
  if (rows.length > 20_000) throw new RangeError('Excel export exceeds the safe 20,000-row limit');
  const headers: (keyof ExportedUserRow)[] = ['name','mobile','studentNumber','roles','verified','permissions'];
  const titles = ['نام کاربر','شماره موبایل','شماره دانشجویی','نقش‌ها','تأیید موبایل','مجوزها'];
  const all = [titles, ...rows.map(row => headers.map(key => String(row[key] ?? '')))];
  const sheetRows = all.map((values, rowIndex) => {
    const cells = values.map((value, i) =>
      `<c r="${excelColumn(i + 1)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`,
    ).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
<cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="3" width="22" customWidth="1"/><col min="4" max="6" width="36" customWidth="1"/></cols>
<sheetData>${sheetRows}</sheetData></worksheet>`;
  const zip = new AdmZip();
  const append = (name: string, xml: string) => zip.addFile(name, Buffer.from(xml, 'utf8'));
  append('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  append('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  append('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews><sheets><sheet name="کاربران درس‌چین" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  append('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  append('xl/worksheets/sheet1.xml', sheet);
  return zip.toBuffer();
}
