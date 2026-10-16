import JSZip from 'jszip';
import type { Student, AcademicYear } from './types';

export interface CertificateData {
  studentId: string;
  fullName: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  domicile: string;
  nationalite: string;
  cin: string;
  anneeEtude: string;
  matricule: string;
  anneeScolaire: string;
  numeroNational: string;
  filiere: string;
  usage: string;
  dateDelivrance: string;
  directrice: string;
  notes?: string;
}

const COMMON_FIRST_NAMES = [
  'FATIMA', 'DOUAE', 'DOAAE', 'YASMINE', 'IKHLASS', 'OUSSAMA', 'ACHRAF', 'CHOROUK',
  'LATIFA', 'MOHAMED', 'MOHAMMED', 'LINA', 'SABAH', 'AYA', 'ZOUHAIR', 'SALMA',
  'HOUDA', 'IMANE', 'AMINE', 'HAMZA', 'OMAR', 'ANAS', 'WALID', 'YOUSSEF',
  'MEHDI', 'HASSAN', 'SAID', 'KHADIJA', 'MERIEM', 'MARYAM', 'ZINEB', 'HAFSA',
  'ASMAA', 'NAOUAL', 'SARA', 'SARAH', 'KAOUTAR', 'KENZA', 'HIBA', 'MANAL', 'NADA', 'ZAHRA'
];

export function parseStudentName(fullName: string): { nom: string; prenom: string } {
  const clean = (fullName || '').trim();
  if (!clean) return { nom: '', prenom: '' };

  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { nom: parts[0].toUpperCase(), prenom: '' };
  }

  const firstUpper = parts[0].toUpperCase();
  const secondUpper = parts.length > 2 ? parts[1].toUpperCase() : '';
  const lastUpper = parts[parts.length - 1].toUpperCase();

  // Compound given name like 'MOHAMED AMINE ELAMARI' or 'FATIMA ZAHRA BENANI'
  if (parts.length >= 3 && COMMON_FIRST_NAMES.includes(firstUpper) && COMMON_FIRST_NAMES.includes(secondUpper)) {
    return {
      prenom: (parts[0] + ' ' + parts[1]).toUpperCase(),
      nom: parts.slice(2).join(' ').toUpperCase()
    };
  }

  // If last word is a known first name (e.g. 'ACHAHBOUNE FATIMA'), nom is first part
  if (COMMON_FIRST_NAMES.includes(lastUpper) && !COMMON_FIRST_NAMES.includes(firstUpper)) {
    return {
      nom: parts.slice(0, parts.length - 1).join(' ').toUpperCase(),
      prenom: lastUpper
    };
  }

  // Check compound family prefixes: EL, AL, AIT, BEN, IBN, BOU
  const familyPrefixes = ['EL', 'AL', 'AIT', 'BEN', 'IBN', 'BOU', 'OULAD', 'OULD'];
  for (let i = 1; i < parts.length; i++) {
    if (familyPrefixes.includes(parts[i].toUpperCase())) {
      return {
        prenom: parts.slice(0, i).join(' ').toUpperCase(),
        nom: parts.slice(i).join(' ').toUpperCase()
      };
    }
  }

  // If first word is a known first name (e.g. 'DOUAE MOURCHID', 'YASMINE IBNOGHAZALA')
  if (COMMON_FIRST_NAMES.includes(firstUpper)) {
    return {
      prenom: parts[0].toUpperCase(),
      nom: parts.slice(1).join(' ').toUpperCase()
    };
  }

  // Default: First name is part 0, Family name is rest
  return {
    prenom: parts[0].toUpperCase(),
    nom: parts.slice(1).join(' ').toUpperCase()
  };
}

export function buildInitialCertificateData(student: Student, academicYears: AcademicYear[] = []): CertificateData {
  const { nom, prenom } = parseStudentName(student.fullName || '');

  // Detect study year: e.g. 1ère Année vs 2ème Année
  let anneeEtude = '1ère Année';
  if (student.className?.toLowerCase().includes('2') || student.group?.toLowerCase().includes('2028')) {
    anneeEtude = '2ème Année';
  }

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();

  const currentAy = academicYears.find(y => y.isCurrent) || academicYears[0];
  const anneeScolaire = student.academicYear || currentAy?.name || `${yyyy}/${yyyy + 1}`;

  return {
    studentId: student.id,
    fullName: student.fullName,
    nom: nom.toUpperCase(),
    prenom: prenom.toUpperCase(),
    dateNaissance: '',
    lieuNaissance: 'RABAT',
    domicile: student.address || 'RABAT, MAROC',
    nationalite: 'MAROCAINE',
    cin: '',
    anneeEtude,
    matricule: student.studentId || '',
    anneeScolaire,
    numeroNational: '',
    filiere: 'ATAM (Accueil dans les transports aériens et maritimes : Option hôtesse de l’air/steward)',
    usage: 'ADMINISTRATIF',
    dateDelivrance: `${dd}/${mm}/${yyyy}`,
    directrice: "Mme M’ZIOUAD IMANE",
  };
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\u00C0-\u00FF-]/g, '_').replace(/_+/g, '_');
}

/**
 * Replace placeholders and specific target runs in document.xml while preserving all Word XML formatting
 */
function processDocumentXml(xml: string, data: CertificateData): string {
  // 1. Isolate the first certificate section (section 0)
  // In WordprocessingML, intermediate section properties are stored inside a paragraph:
  // <w:p ...><w:pPr><w:sectPr ...>...</w:sectPr></w:pPr></w:p>
  // For the final (and in our single-page document, only) section, <w:sectPr> must be
  // a direct child of <w:body>. We extract sectPr and strip the wrapping paragraph.
  const sectPrEnd = xml.indexOf('</w:sectPr>');
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  let bodyContent = xml;
  let sectPrXml = '';

  if (sectPrEnd > 0 && bodyStart > 0) {
    const sectPrStart = xml.lastIndexOf('<w:sectPr', sectPrEnd);
    const pStart = xml.lastIndexOf('<w:p ', sectPrStart);
    if (sectPrStart > 0 && pStart > bodyStart) {
      sectPrXml = xml.slice(sectPrStart, sectPrEnd + '</w:sectPr>'.length);
      bodyContent = xml.slice(bodyStart, pStart);
    }
  }

  let updated = bodyContent;

  // 1. Replace Date: e.g. "DATE : 15/10/2026"
  updated = updated.replace(
    /(DATE\s*[:\u00A0]\s*<\/w:t><\/w:r>)(?:[\s\S]*?)(<\/w:p>)/i,
    `$1<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve"> ${data.dateDelivrance}</w:t></w:r>$2`
  );
  updated = updated.replace(/(DATE\s*[:\u00A0]\s*)([0-9\s/]+)/gi, `$1${data.dateDelivrance}`);

  // 2. Replace Nom (in template: SAKIM) with exact official XML alignment runs
  const p10Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>Nom<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  const cleanP10 = `<w:p w14:paraId="50531F5B" w14:textId="3C5B9956" w:rsidR="007D13A6" w:rsidRDefault="007D13A6" w:rsidP="00956483"><w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Nom</w:t></w:r><w:r w:rsidR="00B56AEA"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">    </w:t></w:r><w:r w:rsidR="00D72450"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">  </w:t></w:r><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t> </w:t></w:r><w:r w:rsidRPr="005F00F5"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>:</w:t></w:r><w:r w:rsidR="00956483"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AA217F"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${data.nom}</w:t></w:r></w:p>`;
  if (p10Regex.test(updated)) {
    updated = updated.replace(p10Regex, cleanP10);
  } else {
    updated = updated.replace(/<w:t>SAKIM<\/w:t>/g, `<w:t>${data.nom}</w:t>`);
  }

  // 3. Replace Prénom (in template: KHADIJA) with exact official XML runs
  const p12Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>Prénom[\s\S]*?<\/w:p>/;
  const cleanP12 = `<w:p w14:paraId="2B8959FD" w14:textId="2E797C7E" w:rsidR="007D13A6" w:rsidRPr="00AC420A" w:rsidRDefault="007D13A6" w:rsidP="000E7FAC"><w:pPr><w:rPr><w:u w:val="single"/></w:rPr></w:pPr><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Prénom :</w:t></w:r><w:r w:rsidR="00956483"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AA217F"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${data.prenom}</w:t></w:r></w:p>`;
  if (p12Regex.test(updated)) {
    updated = updated.replace(p12Regex, cleanP12);
  } else {
    updated = updated.replace(/<w:t>KHADIJA<\/w:t>/g, `<w:t>${data.prenom}</w:t>`);
  }

  // 4. Replace Né (e) le: e.g. "06/09/2008" or "22/10/2002"
  updated = updated.replace(/<w:t>06\/09\/2008<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);
  updated = updated.replace(/<w:t>22\/10\/2002<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);
  updated = updated.replace(/<w:t>19\/05\/2004#?<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);

  // 5. Replace A : [Lieu]
  updated = updated.replace(/<w:t>ZEMAMRA SIDI BENNOUR<\/w:t>/g, `<w:t>${data.lieuNaissance || 'RABAT'}</w:t>`);

  // 6. Replace Domicile
  updated = updated.replace(
    /<w:t>HAY KALAA AV MOUATAMID IBN ABBAD PSG 02 NR 02 M’DIQ<\/w:t>/g,
    `<w:t>${data.domicile || 'RABAT'}</w:t>`
  );

  // 7. Replace Nationalité
  if (data.nationalite) {
    updated = updated.replace(
      /<w:t[^>]*>\s*MAROCAINE\s*<\/w:t>/g,
      `<w:t xml:space="preserve"> ${data.nationalite}</w:t>`
    );
  }

  // 8. Replace CIN: e.g. "LG55372"
  updated = updated.replace(/<w:t>LG55372<\/w:t>/g, `<w:t>${data.cin || ''}</w:t>`);

  // 9. Replace Année d'étude (1ère Année / 2ème Année) in registration paragraph
  if (data.anneeEtude) {
    updated = updated.replace(
      /<w:t>1<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>Année\s*<\/w:t><\/w:r>/g,
      `<w:t>${data.anneeEtude} </w:t></w:r>`
    );
  }

  // 10. Replace Matricule in registration phrase: e.g. F57/27
  if (data.matricule) {
    updated = updated.replace(
      /<w:t>F<\/w:t><\/w:r>[\s\S]{0,300}?<w:t>\/27<\/w:t><\/w:r>/g,
      `<w:t>${data.matricule}</w:t></w:r>`
    );
    updated = updated.replace(/<w:t>F\/24\s*#?\s*<\/w:t>/g, `<w:t>${data.matricule}</w:t>`);
  }

  // 11. Replace Année scolaire in drawing box runs: 202 6 /202 7
  if (data.anneeScolaire) {
    updated = updated.replace(
      /<w:t>202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>6<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>\/202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>7<\/w:t><\/w:r>/g,
      `<w:t>${data.anneeScolaire}</w:t></w:r>`
    );
    updated = updated.replace(/<w:t>2026\/2027<\/w:t>/g, `<w:t>${data.anneeScolaire}</w:t>`);
    updated = updated.replace(/<w:t>##2023\/2024##<\/w:t>/g, `<w:t>${data.anneeScolaire}</w:t>`);
  }

  // 12. Replace NUMERO NATIONAL: e.g. "P140169168"
  updated = updated.replace(/<w:t>P140169168<\/w:t>/g, `<w:t>${data.numeroNational || ''}</w:t>`);

  // 13. Replace Filière / Classe if custom
  if (data.filiere) {
    updated = updated.replace(
      /En classe de\s*[:\u00A0]\s*ATAM[^<]*/g,
      `En classe de : ${data.filiere}`
    );
  }

  // 14. Replace Usage if custom
  if (data.usage) {
    updated = updated.replace(/<w:t>ADMINISTRATIF#?<\/w:t>/g, `<w:t>${data.usage}</w:t>`);
    updated = updated.replace(/(délivrée pour usage\s*[:\u00A0]\s*)([A-Z\s]+)/gi, `$1${data.usage}`);
  }

  // 15. Replace Directrice name if custom
  if (data.directrice && data.directrice !== "Mme M’ZIOUAD IMANE") {
    updated = updated.replace(/Mme M’ZIOUAD IMANE/g, data.directrice);
    updated = updated.replace(/Mme M’Ziouad Imane/g, data.directrice);
  }

  if (sectPrXml && bodyStart > 0) {
    return xml.slice(0, bodyStart) + updated + sectPrXml + '</w:body></w:document>';
  }
  return updated;
}

/**
 * Generate a genuine .docx certificate by updating the official template with student data and INFOHAS logo
 */
export async function generateCertificateDocx(
  data: CertificateData,
  templateBuffer?: ArrayBuffer | Uint8Array,
  logoBuffer?: ArrayBuffer | Uint8Array
): Promise<{ docxBuffer: Uint8Array; filename: string }> {
  let sourceBuffer = templateBuffer;

  // Fallback: fetch from /templates/CERTIFICAT_SCOLARITE_2025.docx if in browser
  if (!sourceBuffer && typeof window !== 'undefined') {
    try {
      const res = await fetch('/templates/CERTIFICAT_SCOLARITE_2025.docx');
      if (res.ok) {
        sourceBuffer = await res.arrayBuffer();
      }
    } catch (e) {
      console.warn('Could not fetch template over HTTP:', e);
    }
  }

  if (!sourceBuffer) {
    throw new Error('Template document buffer not provided or accessible');
  }

  const zip = await JSZip.loadAsync(sourceBuffer);

  // 1. Process document.xml
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    const docXml = await docFile.async('string');
    const processedXml = processDocumentXml(docXml, data);
    zip.file('word/document.xml', processedXml);
  }

  // 2. Process headers (replace old logo image3.jpeg with current INFOHAS logo)
  let logoBytes = logoBuffer;
  if (!logoBytes && typeof window !== 'undefined') {
    try {
      const lRes = await fetch('/infohas-logo.png');
      if (lRes.ok) logoBytes = await lRes.arrayBuffer();
    } catch {}
  }

  if (logoBytes) {
    zip.file('word/media/image3.jpeg', logoBytes);

    // Prevent logo stretching and deformation:
    // The official template originally had cx="3534410" cy="468630" (wide 7.54:1 ratio banner).
    // Our circular INFOHAS emblem is 1024x1024 (1:1 square).
    // We update the drawing container extents in all header files to a balanced square (824230 x 824230 EMU,
    // exactly matching the right-side accreditation badge) so the logo renders with 100% natural, un-distorted proportions.
    for (const hName of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/header4.xml']) {
      const hFile = zip.file(hName);
      if (hFile) {
        const hXml = await hFile.async('string');
        const updatedHXml = hXml.replace(/cx="3534410"\s+cy="468630"/g, 'cx="824230" cy="824230"');
        zip.file(hName, updatedHXml);
      }
    }
  }

  // 3. Generate sanitized filename
  const cleanNom = sanitizeFilename(data.nom || 'ETUDIANT');
  const cleanPrenom = sanitizeFilename(data.prenom || 'Stagiaire');
  const cleanYear = sanitizeFilename(data.anneeScolaire || '2026-2027');
  const filename = `Certificat_Scolarite_${cleanNom}_${cleanPrenom}_${cleanYear}.docx`;

  const docxBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  return { docxBuffer, filename };
}
