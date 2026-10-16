import JSZip from 'jszip';
import type { Student, AcademicYear } from './types';
import { DocumentDesignPreset, toOpenXmlHexColor } from './documentDesignTypes';

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
function processDocumentXml(xml: string, data: CertificateData, designConfig?: DocumentDesignPreset): string {
  // 1. Isolate the first certificate section (section 0)
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

  // 1. Replace Date: e.g. "DATE : 16/10/2026"
  // Root cause fix: The template originally had 'DATE : ' and separate digit runs.
  // Previously, an extra secondary regex matched the whitespace in 'DATE : ' and inserted the date a second time,
  // causing "DATE :16/10/2026 16/10/2026".
  // This clean single replacement formats exactly ONE date in the heading with pristine Word alignment.
  const pDateRegex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?DATE\s*[:\u00A0][\s\S]*?<\/w:p>/;
  const cleanDateParagraph = `<w:p w14:paraId="7899BA29" w14:textId="11629A04" w:rsidR="00A17DC3" w:rsidRPr="00614FE3" w:rsidRDefault="00614FE3" w:rsidP="00614FE3"><w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">                                                                                                                    </w:t></w:r><w:r w:rsidR="00EB4E3B" w:rsidRPr="00614FE3"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">  DATE : </w:t></w:r><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${data.dateDelivrance}</w:t></w:r></w:p>`;

  if (pDateRegex.test(updated)) {
    updated = updated.replace(pDateRegex, cleanDateParagraph);
  } else {
    updated = updated.replace(
      /(DATE\s*[:\u00A0]\s*<\/w:t><\/w:r>)(?:[\s\S]*?)(<\/w:p>)/i,
      `$1<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve"> ${data.dateDelivrance}</w:t></w:r>$2`
    );
  }

  // 2. Custom Heading Styling (P3 ATTESTATION DE SCOLARITE) if custom design provided
  if (designConfig?.heading) {
    const headingColor = toOpenXmlHexColor(designConfig.heading.textColor, '17365D');
    const fontFamily = designConfig.heading.fontFamily || 'Times New Roman';
    const szVal = Math.round((designConfig.heading.fontSize || 18) * 2);
    const isBold = designConfig.heading.bold ? '<w:b/><w:bCs/>' : '';
    const isItalic = designConfig.heading.italic ? '<w:i/><w:iCs/>' : '';
    const headingText = (!designConfig.heading.isTextLocked && designConfig.heading.text)
      ? designConfig.heading.text
      : 'ATTESTATION DE SCOLARITE';

    const p3Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>ATTESTATION DE SCOLARITE<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
    const cleanP3 = `<w:p w14:paraId="0443EC96" w14:textId="4E983514" w:rsidR="00A17DC3" w:rsidRPr="00614FE3" w:rsidRDefault="00614FE3" w:rsidP="00105CBB"><w:pPr><w:jc w:val="${designConfig.heading.alignment || 'center'}"/><w:rPr><w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/><w:color w:val="${headingColor}"/>${isBold}${isItalic}<w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/></w:rPr></w:pPr><w:r w:rsidR="00A17DC3" w:rsidRPr="00614FE3"><w:rPr><w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/><w:color w:val="${headingColor}"/>${isBold}${isItalic}<w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/></w:rPr><w:t>${headingText}</w:t></w:r></w:p>`;

    if (p3Regex.test(updated)) {
      updated = updated.replace(p3Regex, cleanP3);
    }
  }

  // 3. Replace Nom (in template: SAKIM) with exact official XML alignment runs
  const p10Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>Nom<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  const cleanP10 = `<w:p w14:paraId="50531F5B" w14:textId="3C5B9956" w:rsidR="007D13A6" w:rsidRDefault="007D13A6" w:rsidP="00956483"><w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Nom</w:t></w:r><w:r w:rsidR="00B56AEA"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">    </w:t></w:r><w:r w:rsidR="00D72450"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">  </w:t></w:r><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t> </w:t></w:r><w:r w:rsidRPr="005F00F5"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>:</w:t></w:r><w:r w:rsidR="00956483"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AA217F"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${data.nom}</w:t></w:r></w:p>`;
  if (p10Regex.test(updated)) {
    updated = updated.replace(p10Regex, cleanP10);
  } else {
    updated = updated.replace(/<w:t>SAKIM<\/w:t>/g, `<w:t>${data.nom}</w:t>`);
  }

  // 4. Replace Prénom (in template: KHADIJA) with exact official XML runs
  const p12Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>Prénom[\s\S]*?<\/w:p>/;
  const cleanP12 = `<w:p w14:paraId="2B8959FD" w14:textId="2E797C7E" w:rsidR="007D13A6" w:rsidRPr="00AC420A" w:rsidRDefault="007D13A6" w:rsidP="000E7FAC"><w:pPr><w:rPr><w:u w:val="single"/></w:rPr></w:pPr><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Prénom :</w:t></w:r><w:r w:rsidR="00956483"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AA217F"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${data.prenom}</w:t></w:r></w:p>`;
  if (p12Regex.test(updated)) {
    updated = updated.replace(p12Regex, cleanP12);
  } else {
    updated = updated.replace(/<w:t>KHADIJA<\/w:t>/g, `<w:t>${data.prenom}</w:t>`);
  }

  // 5. Replace Né (e) le: e.g. "06/09/2008" or "22/10/2002"
  updated = updated.replace(/<w:t>06\/09\/2008<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);
  updated = updated.replace(/<w:t>22\/10\/2002<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);
  updated = updated.replace(/<w:t>19\/05\/2004#?<\/w:t>/g, `<w:t>${data.dateNaissance || '00/00/0000'}</w:t>`);

  // 6. Replace A : [Lieu]
  updated = updated.replace(/<w:t>ZEMAMRA SIDI BENNOUR<\/w:t>/g, `<w:t>${data.lieuNaissance || 'RABAT'}</w:t>`);

  // 7. Replace Domicile
  updated = updated.replace(
    /<w:t>HAY KALAA AV MOUATAMID IBN ABBAD PSG 02 NR 02 M’DIQ<\/w:t>/g,
    `<w:t>${data.domicile || 'RABAT'}</w:t>`
  );

  // 8. Replace Nationalité
  if (data.nationalite) {
    updated = updated.replace(
      /<w:t[^>]*>\s*MAROCAINE\s*<\/w:t>/g,
      `<w:t xml:space="preserve"> ${data.nationalite}</w:t>`
    );
  }

  // 9. Replace CIN: e.g. "LG55372"
  updated = updated.replace(/<w:t>LG55372<\/w:t>/g, `<w:t>${data.cin || ''}</w:t>`);

  // 10. Replace Année d'étude (1ère Année / 2ème Année) in registration paragraph
  if (data.anneeEtude) {
    updated = updated.replace(
      /<w:t>1<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>Année\s*<\/w:t><\/w:r>/g,
      `<w:t>${data.anneeEtude} </w:t></w:r>`
    );
  }

  // 11. Replace Matricule in registration phrase: e.g. F57/27
  if (data.matricule) {
    updated = updated.replace(
      /<w:t>F<\/w:t><\/w:r>[\s\S]{0,300}?<w:t>\/27<\/w:t><\/w:r>/g,
      `<w:t>${data.matricule}</w:t></w:r>`
    );
    updated = updated.replace(/<w:t>F\/24\s*#?\s*<\/w:t>/g, `<w:t>${data.matricule}</w:t>`);
  }

  // 12. Replace Année scolaire in drawing box runs: 202 6 /202 7
  if (data.anneeScolaire) {
    updated = updated.replace(
      /<w:t>202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>6<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>\/202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>7<\/w:t><\/w:r>/g,
      `<w:t>${data.anneeScolaire}</w:t></w:r>`
    );
    updated = updated.replace(/<w:t>2026\/2027<\/w:t>/g, `<w:t>${data.anneeScolaire}</w:t>`);
    updated = updated.replace(/<w:t>##2023\/2024##<\/w:t>/g, `<w:t>${data.anneeScolaire}</w:t>`);
  }

  // 13. Replace NUMERO NATIONAL: e.g. "P140169168"
  updated = updated.replace(/<w:t>P140169168<\/w:t>/g, `<w:t>${data.numeroNational || ''}</w:t>`);

  // 14. Replace Filière / Classe if custom
  if (data.filiere) {
    updated = updated.replace(
      /En classe de\s*[:\u00A0]\s*ATAM[^<]*/g,
      `En classe de : ${data.filiere}`
    );
  }

  // 15. Replace Usage if custom
  if (data.usage) {
    updated = updated.replace(/<w:t>ADMINISTRATIF#?<\/w:t>/g, `<w:t>${data.usage}</w:t>`);
    updated = updated.replace(/(délivrée pour usage\s*[:\u00A0]\s*)([A-Z\s]+)/gi, `$1${data.usage}`);
  }

  // 16. Replace Directrice name if custom
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
 * Generate a genuine .docx certificate by updating the official template with student data and customized styling/logo
 */
export async function generateCertificateDocx(
  data: CertificateData,
  templateBuffer?: ArrayBuffer | Uint8Array,
  logoBuffer?: ArrayBuffer | Uint8Array,
  designConfig?: DocumentDesignPreset
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

  // 1. Process document.xml with design configuration
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    const docXml = await docFile.async('string');
    const processedXml = processDocumentXml(docXml, data, designConfig);
    zip.file('word/document.xml', processedXml);
  }

  // 2. Process logo (Default: official INFOHAS logo; or custom uploaded logo if configured)
  let logoBytes = logoBuffer;

  // If custom logo configured and provided via base64 data URL
  if (!logoBytes && designConfig?.logo?.selectedLogo === 'custom' && designConfig.logo.customLogoUrl) {
    try {
      const url = designConfig.logo.customLogoUrl;
      if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        if (base64Data) {
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          logoBytes = bytes;
        }
      }
    } catch (e) {
      console.warn('Could not decode custom logo bytes:', e);
    }
  }

  // Fallback to official INFOHAS logo
  if (!logoBytes && typeof window !== 'undefined') {
    try {
      const lRes = await fetch('/infohas-logo.png');
      if (lRes.ok) logoBytes = await lRes.arrayBuffer();
    } catch {}
  }

  if (logoBytes) {
    zip.file('word/media/image3.jpeg', logoBytes);

    // Dynamic logo dimensions:
    // Convert configured width & height in px to Word EMUs (1 px ≈ 9525 EMU)
    const logoW = designConfig?.logo?.width || 85;
    const logoH = designConfig?.logo?.height || 85;
    const wEmu = Math.round(logoW * 9525);
    const hEmu = Math.round(logoH * 9525);

    for (const hName of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/header4.xml']) {
      const hFile = zip.file(hName);
      if (hFile) {
        const hXml = await hFile.async('string');
        const updatedHXml = hXml.replace(/cx="\d+"\s+cy="\d+"/g, `cx="${wEmu}" cy="${hEmu}"`);
        zip.file(hName, updatedHXml);
      }
    }
  }

  // 3. Process footers (apply custom footer color, font and text if provided)
  if (designConfig?.footer) {
    const footerColor = toOpenXmlHexColor(designConfig.footer.textColor, '475569');
    const footerFont = designConfig.footer.fontFamily || 'Calibri';
    const footerSz = Math.round((designConfig.footer.fontSize || 9) * 2);

    for (const fName of ['word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml', 'word/footer4.xml']) {
      const fFile = zip.file(fName);
      if (fFile) {
        let fXml = await fFile.async('string');
        // Update font color in footer text runs
        fXml = fXml.replace(/<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<\/w:rPr>/g, (rPr) => {
          if (rPr.includes('<w:color')) {
            return rPr.replace(/<w:color\s+w:val="[^"]*"/g, `<w:color w:val="${footerColor}"`);
          } else {
            return rPr.replace('</w:rPr>', `<w:color w:val="${footerColor}"/><w:rFonts w:ascii="${footerFont}" w:hAnsi="${footerFont}"/><w:sz w:val="${footerSz}"/><w:szCs w:val="${footerSz}"/></w:rPr>`);
          }
        });
        zip.file(fName, fXml);
      }
    }
  }

  // 4. Generate sanitized filename
  const cleanNom = sanitizeFilename(data.nom || 'ETUDIANT');
  const cleanPrenom = sanitizeFilename(data.prenom || 'Stagiaire');
  const cleanYear = sanitizeFilename(data.anneeScolaire || '2026-2027');
  const filename = `Certificat_Scolarite_${cleanNom}_${cleanPrenom}_${cleanYear}.docx`;

  const docxBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  return { docxBuffer, filename };
}
