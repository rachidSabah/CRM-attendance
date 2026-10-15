import * as XLSX from 'xlsx';
import type { Student, Class } from './types';

export interface ParsedStudentRow {
  tempId: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  secondPhone?: string;
  guardianName: string;
  guardianPhone: string;
  group: string;
  notes: string;
  isDuplicate: boolean;
  existingStudent?: Student;
  selected: boolean;
}

export interface ParseResult {
  students: ParsedStudentRow[];
  groups: string[];
  totalCount: number;
  duplicateCount: number;
  newCount: number;
  sheetName: string;
}

function cleanText(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s.toUpperCase() === 'X' || s === '-' || s.toLowerCase() === 'null') return '';
  return s;
}

function cleanPhoneAndExtract(val: unknown): { phone: string; extra: string } {
  if (val === null || val === undefined) return { phone: '', extra: '' };
  let str = String(val).trim();
  if (str.toUpperCase() === 'X' || str === '-' || str.toLowerCase() === 'null') {
    return { phone: '', extra: '' };
  }

  // Check if string begins with phone digits (optional +, 0[5-8] or international prefix)
  const match = str.match(/^(\+?[0-9\s]{8,18})(.*)$/);
  if (match) {
    const rawPhone = match[1].replace(/\s+/g, ' ').trim();
    const extra = match[2].trim();
    return { phone: rawPhone, extra };
  }

  return { phone: str.replace(/\s+/g, ' ').trim(), extra: '' };
}

/**
 * Checks if a row looks like a group/class header banner (e.g. "LONDON 2027", "OTTAWA 2027", "BARCELONA 2027")
 */
function isGroupHeaderRow(nonNullCells: string[]): boolean {
  if (nonNullCells.length !== 1) return false;
  const first = nonNullCells[0].toLowerCase();
  const notHeaders = ['num inscription', 'student name', 'matricule', 'id', 'nom', 'prenom', 'mother number', 'father number'];
  return !notHeaders.some(k => first.includes(k));
}

/**
 * Parse any student spreadsheet (XLSX, XLS, CSV) with support for:
 * 1. Multi-group layout (e.g., "H:\GROUP CONTACT 26-28.xlsx" with LONDON 2027, OTTAWA 2027, etc.)
 * 2. Standard tabular layout with column headers on row 0
 */
export function parseStudentsSpreadsheet(
  buffer: ArrayBuffer | Uint8Array,
  existingStudents: Student[] = [],
  existingClasses: Class[] = []
): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0] || 'Feuil1';
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { students: [], groups: [], totalCount: 0, duplicateCount: 0, newCount: 0, sheetName };
  }

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (!rawRows || rawRows.length === 0) {
    return { students: [], groups: [], totalCount: 0, duplicateCount: 0, newCount: 0, sheetName };
  }

  // Pre-index existing students for quick duplicate lookup
  const existingIdMap = new Map<string, Student>();
  const existingNameMap = new Map<string, Student>();
  for (const s of existingStudents) {
    if (s.studentId) existingIdMap.set(s.studentId.trim().toLowerCase(), s);
    if (s.fullName) existingNameMap.set(s.fullName.trim().toLowerCase(), s);
  }

  // Detect whether sheet is Multi-Group format
  let hasMultiGroupBanners = false;
  for (let i = 0; i < Math.min(rawRows.length, 60); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonNull = row.map(cleanText).filter(Boolean);
    if (isGroupHeaderRow(nonNull)) {
      hasMultiGroupBanners = true;
      break;
    }
  }

  const parsedStudents: ParsedStudentRow[] = [];
  const groupsSet = new Set<string>();

  if (hasMultiGroupBanners) {
    // ===== Multi-Group Banner Engine (e.g., GROUP CONTACT 26-28.xlsx) =====
    let currentGroup = 'DEFAULT';

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;
      const nonNull = row.map(cleanText).filter(Boolean);
      if (nonNull.length === 0) continue;

      if (isGroupHeaderRow(nonNull)) {
        currentGroup = nonNull[0];
        groupsSet.add(currentGroup);
        continue;
      }

      // Skip table column headers or sub-headers
      const isHeaderRow = nonNull.some(c => {
        const lc = c.toLowerCase();
        return lc.includes('num inscription') || lc.includes('student name') || lc.includes('other contact') || lc.includes('mother number') || lc.includes('father number');
      });
      if (isHeaderRow) continue;

      const studentId = cleanText(row[0]);
      const fullName = cleanText(row[1]);
      if (!studentId && !fullName) continue;

      const email = cleanText(row[2]);
      const { phone, extra: phoneExtra } = cleanPhoneAndExtract(row[3]);
      const { phone: secondPhone, extra: secExtra } = cleanPhoneAndExtract(row[4]);

      // Guardian 1 (e.g. Mother in LONDON, Father in OTTAWA)
      const g1Name = cleanText(row[5]);
      const { phone: g1Phone, extra: g1Extra } = cleanPhoneAndExtract(row[6]);

      // Guardian 2 (e.g. Father in LONDON, Mother in OTTAWA)
      const g2Name = cleanText(row[7]);
      const { phone: g2Phone, extra: g2Extra } = cleanPhoneAndExtract(row[8]);

      // Determine primary guardian
      let guardianName = g1Name || g2Name || '';
      let guardianPhone = g1Phone || g2Phone || '';
      if (!guardianPhone && g2Phone) {
        guardianPhone = g2Phone;
        guardianName = g2Name;
      }

      // Build structured contact note so NO parent data is discarded
      const noteParts: string[] = [];
      if (g1Name || g1Phone) {
        noteParts.push(`Parent 1: ${[g1Name, g1Phone, g1Extra].filter(Boolean).join(' - ')}`);
      }
      if (g2Name || g2Phone) {
        noteParts.push(`Parent 2: ${[g2Name, g2Phone, g2Extra].filter(Boolean).join(' - ')}`);
      }
      if (secondPhone || secExtra) {
        noteParts.push(`2ème Tél: ${[secondPhone, secExtra].filter(Boolean).join(' ')}`);
      }
      if (phoneExtra) {
        noteParts.push(`Info Tél: ${phoneExtra}`);
      }

      const grp = currentGroup || 'Groupe 1';
      groupsSet.add(grp);

      // Check duplicates
      const matchedExisting = (studentId && existingIdMap.get(studentId.toLowerCase())) ||
                              (fullName && existingNameMap.get(fullName.toLowerCase()));

      parsedStudents.push({
        tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
        studentId,
        fullName,
        email,
        phone,
        secondPhone,
        guardianName,
        guardianPhone,
        group: grp,
        notes: noteParts.join(' | '),
        isDuplicate: Boolean(matchedExisting),
        existingStudent: matchedExisting,
        selected: true,
      });
    }
  } else {
    // ===== Standard Tabular Format Engine (Row 0 = headers) =====
    let headerRowIdx = 0;
    while (headerRowIdx < rawRows.length && (!rawRows[headerRowIdx] || rawRows[headerRowIdx].filter(x => cleanText(x) !== '').length < 2)) {
      headerRowIdx++;
    }

    if (headerRowIdx < rawRows.length) {
      const headerRow = rawRows[headerRowIdx].map(x => cleanText(x).toLowerCase());
      const findCol = (...synonyms: string[]) => {
        return headerRow.findIndex(h => synonyms.some(s => h.includes(s)));
      };

      const idIdx = findCol('matricule', 'student id', 'studentid', 'num inscription', 'id', 'code');
      const nameIdx = findCol('nom et prenom', 'fullname', 'full name', 'student name', 'nom', 'prenom', 'name');
      const emailIdx = findCol('email', 'courriel', 'mail');
      const phoneIdx = findCol('telephone', 'phone', 'tel', 'gsm', 'mobile');
      const classIdx = findCol('classe', 'class', 'groupe', 'group', 'section');
      const guardianNameIdx = findCol('parent', 'tuteur', 'guardian', 'father', 'mother', 'nom parent');
      const guardianPhoneIdx = findCol('tel parent', 'phone parent', 'guardian phone', 'tel tuteur');
      const notesIdx = findCol('note', 'remarque', 'observation', 'address', 'adresse');

      for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !Array.isArray(row)) continue;
        const nonNull = row.map(cleanText).filter(Boolean);
        if (nonNull.length === 0) continue;

        const fullName = nameIdx >= 0 ? cleanText(row[nameIdx]) : cleanText(row[0]);
        const studentId = idIdx >= 0 ? cleanText(row[idIdx]) : cleanText(row[1]);
        if (!fullName && !studentId) continue;

        const email = emailIdx >= 0 ? cleanText(row[emailIdx]) : '';
        const { phone } = phoneIdx >= 0 ? cleanPhoneAndExtract(row[phoneIdx]) : { phone: '' };
        const grp = classIdx >= 0 && cleanText(row[classIdx]) ? cleanText(row[classIdx]) : 'Classe Générale';
        groupsSet.add(grp);

        const guardianName = guardianNameIdx >= 0 ? cleanText(row[guardianNameIdx]) : '';
        const { phone: guardianPhone } = guardianPhoneIdx >= 0 ? cleanPhoneAndExtract(row[guardianPhoneIdx]) : { phone: '' };
        const notes = notesIdx >= 0 ? cleanText(row[notesIdx]) : '';

        const matchedExisting = (studentId && existingIdMap.get(studentId.toLowerCase())) ||
                                (fullName && existingNameMap.get(fullName.toLowerCase()));

        parsedStudents.push({
          tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
          studentId: studentId || `STD-${Date.now().toString().slice(-4)}`,
          fullName: fullName || studentId,
          email,
          phone,
          guardianName,
          guardianPhone,
          group: grp,
          notes,
          isDuplicate: Boolean(matchedExisting),
          existingStudent: matchedExisting,
          selected: true,
        });
      }
    }
  }

  const duplicateCount = parsedStudents.filter(s => s.isDuplicate).length;
  const newCount = parsedStudents.length - duplicateCount;

  return {
    students: parsedStudents,
    groups: Array.from(groupsSet),
    totalCount: parsedStudents.length,
    duplicateCount,
    newCount,
    sheetName,
  };
}
