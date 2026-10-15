/**
 * CLI script to import students and classes from an Excel file (e.g. H:\GROUP CONTACT 26-28.xlsx)
 * directly into Cloudflare D1 crm-attendance-db or generate the SQL payload.
 */
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = process.argv[2] || 'H:\\GROUP CONTACT 26-28.xlsx';

if (!fs.existsSync(filePath)) {
  console.error(`File not found at: ${filePath}`);
  process.exit(1);
}

console.log(`Reading Excel file from: ${filePath}...`);
const buf = fs.readFileSync(filePath);
const wb = xlsx.read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1 });

function clean(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  return (s.toUpperCase() === 'X' || s === '-' || s.toLowerCase() === 'null') ? '' : s;
}

function cleanPhoneAndExtract(val) {
  if (val === null || val === undefined) return { phone: '', extra: '' };
  let str = String(val).trim();
  if (str.toUpperCase() === 'X' || str === '-' || str.toLowerCase() === 'null') {
    return { phone: '', extra: '' };
  }
  const match = str.match(/^(\+?[0-9\s]{8,18})(.*)$/);
  if (match) {
    const rawPhone = match[1].replace(/\s+/g, ' ').trim();
    const extra = match[2].trim();
    return { phone: rawPhone, extra };
  }
  return { phone: str.replace(/\s+/g, ' ').trim(), extra: '' };
}

function isGroupHeader(nonNullCells) {
  if (nonNullCells.length !== 1) return false;
  const first = nonNullCells[0].toLowerCase();
  const notHeaders = ['num inscription', 'student name', 'matricule', 'id', 'nom', 'prenom', 'mother number', 'father number'];
  return !notHeaders.some(k => first.includes(k));
}

let currentGroup = 'DEFAULT';
const groupsMap = new Map();
const students = [];

for (let i = 0; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || !Array.isArray(row)) continue;
  const nonNull = row.map(clean).filter(Boolean);
  if (nonNull.length === 0) continue;

  if (isGroupHeader(nonNull)) {
    currentGroup = nonNull[0];
    if (!groupsMap.has(currentGroup)) {
      groupsMap.set(currentGroup, {
        id: `cls_${currentGroup.toLowerCase().replace(/[^a-z0-9]/g, '_')}_2027`,
        name: currentGroup,
        academicYear: '2026-2028',
        capacity: 35,
        createdAt: new Date().toISOString(),
      });
    }
    continue;
  }

  const isHeaderRow = nonNull.some(c => {
    const lc = c.toLowerCase();
    return lc.includes('num inscription') || lc.includes('student name') || lc.includes('other contact') || lc.includes('mother number') || lc.includes('father number');
  });
  if (isHeaderRow) continue;

  const studentId = clean(row[0]);
  const fullName = clean(row[1]);
  if (!studentId && !fullName) continue;

  const email = clean(row[2]);
  const { phone, extra: phoneExtra } = cleanPhoneAndExtract(row[3]);
  const { phone: secondPhone, extra: secExtra } = cleanPhoneAndExtract(row[4]);

  const g1Name = clean(row[5]);
  const { phone: g1Phone, extra: g1Extra } = cleanPhoneAndExtract(row[6]);

  const g2Name = clean(row[7]);
  const { phone: g2Phone, extra: g2Extra } = cleanPhoneAndExtract(row[8]);

  let guardianName = g1Name || g2Name || '';
  let guardianPhone = g1Phone || g2Phone || '';
  if (!guardianPhone && g2Phone) {
    guardianPhone = g2Phone;
    guardianName = g2Name;
  }

  const noteParts = [];
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

  const classObj = groupsMap.get(currentGroup);
  const classId = classObj ? classObj.id : '';
  const className = classObj ? classObj.name : currentGroup;

  const id = `std_${studentId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36).slice(-3)}`;

  students.push({
    id,
    studentId,
    fullName,
    classId,
    className,
    group: currentGroup,
    email,
    phone,
    secondPhone,
    guardianName,
    guardianPhone,
    notes: noteParts.join(' | '),
    status: 'active',
    academicYear: '2026-2028',
    disciplinaryStatus: 'normal',
    createdAt: new Date().toISOString(),
  });
}

console.log(`Parsed ${students.length} students across ${groupsMap.size} groups:`);
for (const [grpName, grp] of groupsMap) {
  const count = students.filter(s => s.group === grpName).length;
  console.log(`  - ${grpName}: ${count} students (Class ID: ${grp.id})`);
}

// Generate D1 SQL statements
const sqlStatements = [];
const tenantId = 'default';

// 1. Upsert classes
for (const [_, cls] of groupsMap) {
  const dataStr = JSON.stringify(cls).replace(/'/g, "''");
  sqlStatements.push(
    `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at) VALUES ('${cls.id}', '${tenantId}', 'classes', '${dataStr}', datetime('now')) ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;`
  );
}

// 2. Upsert students
for (const s of students) {
  const dataStr = JSON.stringify(s).replace(/'/g, "''");
  sqlStatements.push(
    `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at) VALUES ('${s.id}', '${tenantId}', 'students', '${dataStr}', datetime('now')) ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;`
  );
}

const outSqlPath = path.join(__dirname, 'imported_students.sql');
fs.writeFileSync(outSqlPath, sqlStatements.join('\n'), 'utf8');
console.log(`Generated SQL script at: ${outSqlPath} (${sqlStatements.length} statements)`);

// Output JSON summary
console.log('Sample student record:');
console.log(JSON.stringify(students[0], null, 2));
