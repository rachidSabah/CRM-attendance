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

export function buildInitialCertificateData(student: Student, academicYears: AcademicYear[] = []): CertificateData {
  const parts = (student.fullName || '').trim().split(/\s+/);
  let nom = '';
  let prenom = '';
  if (parts.length === 1) {
    nom = parts[0];
  } else if (parts.length === 2) {
    nom = parts[0];
    prenom = parts[1];
  } else {
    nom = parts.slice(0, Math.ceil(parts.length / 2)).join(' ');
    prenom = parts.slice(Math.ceil(parts.length / 2)).join(' ');
  }

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

  // Helper to replace text within a <w:p> containing a specific label
  let updated = bodyContent;

  // Replace Date: e.g. "DATE : 15/10/2026"
  updated = updated.replace(
    /(DATE\s*:\s*)([0-9\s/]+)/gi,
    `$1${data.dateDelivrance}`
  );

  // Replace Nom: e.g. "Nom : SAKIM"
  updated = updated.replace(
    /(<w:t[^>]*>\s*Nom\s*:\s*<\/w:t>[\s\S]*?<w:t[^>]*>)([^<]*)(<\/w:t>)/gi,
    `$1${data.nom}$3`
  );
  // Fallback direct run replace for Nom
  updated = updated.replace(/<w:t>Nom\s+:\s*SAKIM<\/w:t>/g, `<w:t>Nom : ${data.nom}</w:t>`);

  // Replace Prénom: e.g. "Prénom : KHADIJA"
  updated = updated.replace(
    /(<w:t[^>]*>\s*Prénom\s*:\s*<\/w:t>[\s\S]*?<w:t[^>]*>)([^<]*)(<\/w:t>)/gi,
    `$1${data.prenom}$3`
  );
  updated = updated.replace(/<w:t>Prénom\s*:\s*KHADIJA<\/w:t>/g, `<w:t>Prénom : ${data.prenom}</w:t>`);

  // Replace Né (e) le: e.g. "06/09/2008"
  updated = updated.replace(/<w:t>06\/09\/2008<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);
  updated = updated.replace(/<w:t>19\/05\/2004#?<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);

  // Replace A : [Lieu]
  updated = updated.replace(/<w:t>ZEMAMRA SIDI BENNOUR<\/w:t>/g, `<w:t>${data.lieuNaissance || 'RABAT'}</w:t>`);

  // Replace Domicile
  updated = updated.replace(
    /<w:t>HAY KALAA AV MOUATAMID IBN ABBAD PSG 02 NR 02 M’DIQ<\/w:t>/g,
    `<w:t>${data.domicile || 'RABAT'}</w:t>`
  );

  // Replace Nationalité: e.g. "<w:t xml:space="preserve"> MAROCAINE</w:t>"
  if (data.nationalite) {
    updated = updated.replace(
      /<w:t[^>]*>\s*MAROCAINE\s*<\/w:t>/g,
      `<w:t xml:space="preserve"> ${data.nationalite}</w:t>`
    );
  }

  // Replace CIN: e.g. "LG55372"
  updated = updated.replace(/<w:t>LG55372<\/w:t>/g, `<w:t>${data.cin || ''}</w:t>`);

  // Replace Année d'étude (1ère Année / 2ème Année) in registration paragraph
  if (data.anneeEtude) {
    updated = updated.replace(
      /<w:t>1<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>Année\s*<\/w:t><\/w:r>/g,
      `<w:t>${data.anneeEtude} </w:t></w:r>`
    );
  }

  // Replace Matricule in registration phrase: e.g. F57/27
  updated = updated.replace(
    /<w:t>F<\/w:t><\/w:r>[\s\S]{0,300}?<w:t>\/27<\/w:t><\/w:r>/g,
    `<w:t>${data.matricule}</w:t></w:r>`
  );
  updated = updated.replace(/<w:t>F\/24\s*#?\s*<\/w:t>/g, `<w:t>${data.matricule}</w:t>`);

  // Replace Année scolaire in drawing box runs: 202 6 /202 7
  if (data.anneeScolaire) {
    updated = updated.replace(
      /<w:t>202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>6<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>\/202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>7<\/w:t><\/w:r>/g,
      `<w:t>${data.anneeScolaire}</w:t></w:r>`
    );
    updated = updated.replace(/<w:t>2026\/2027<\/w:t>/g, `<w:t>${data.anneeScolaire}</w:t>`);
    updated = updated.replace(/<w:t>##2023\/2024##<\/w:t>/g, `<w:t>${data.anneeScolaire}</w:t>`);
  }

  // Replace NUMERO NATIONAL: e.g. "P140169168"
  updated = updated.replace(/<w:t>P140169168<\/w:t>/g, `<w:t>${data.numeroNational || ''}</w:t>`);

  // Replace Filière / Classe if custom
  if (data.filiere) {
    updated = updated.replace(
      /En classe de\s*:\s*ATAM[^<]*/g,
      `En classe de : ${data.filiere}`
    );
  }

  // Replace Usage if custom
  if (data.usage) {
    updated = updated.replace(/<w:t>ADMINISTRATIF#?<\/w:t>/g, `<w:t>${data.usage}</w:t>`);
    updated = updated.replace(/(délivrée pour usage\s*:\s*)([A-Z\s]+)/gi, `$1${data.usage}`);
  }

  // Replace Directrice name if custom
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
