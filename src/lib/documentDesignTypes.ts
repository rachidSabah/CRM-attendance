/**
 * Types and default configurations for INFOHAS Document Design & Customization Panel
 */

export type DocumentType = 'certificate' | 'attendance_report' | 'administrative_doc';

export interface HeadingConfig {
  text: string;
  isTextLocked?: boolean;
  textColor: string;          // Hex e.g. '#17365D'
  backgroundColor: string;    // Hex e.g. '#FFFFFF' or 'transparent'
  fontFamily: string;         // 'Times New Roman' | 'Arial' | 'Calibri' | 'Georgia' | 'Montserrat' | 'Garamond'
  fontSize: number;           // in pt e.g. 16, 18, 20
  bold: boolean;
  italic: boolean;
  alignment: 'left' | 'center' | 'right';
  spacingTop: number;         // in pt
  spacingBottom: number;      // in pt
  showBottomBorder: boolean;
  borderColor: string;        // Hex e.g. '#17365D'
  showSeparatorLine: boolean;
}

export interface FooterConfig {
  text: string;               // Multi-line institutional footer
  textColor: string;          // Hex e.g. '#64748B'
  backgroundColor: string;    // Hex e.g. '#FFFFFF' or 'transparent'
  fontFamily: string;
  fontSize: number;           // in pt e.g. 9
  alignment: 'left' | 'center' | 'right';
  showSeparatorLine: boolean;
  separatorColor: string;     // Hex e.g. '#CBD5E1'
  spacingBottom: number;
  showPageNumber: boolean;
  contactInfo?: string;
}

export interface LogoConfig {
  selectedLogo: 'infohas' | 'custom';
  customLogoUrl?: string | null;  // base64 data URL or uploaded relative URL
  customLogoFilename?: string;
  width: number;                  // display width in px (e.g. 90)
  height: number;                 // display height in px (e.g. 90)
  alignment: 'left' | 'center' | 'right';
  preserveAspectRatio: boolean;
}

export interface DocumentDesignPreset {
  id: string;
  name: string;
  documentType: DocumentType;
  isDefault: boolean;
  heading: HeadingConfig;
  footer: FooterConfig;
  logo: LogoConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCustomizationSettings {
  activePresetIdByDocType: Record<DocumentType, string>;
  presets: DocumentDesignPreset[];
  updatedAt: string;
}

/**
 * Validates a hexadecimal color code (e.g. '#17365D', '#fff', '#123456')
 */
export function isValidHexColor(hex: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

/**
 * Normalizes hex color for WordprocessingML (<w:color w:val="17365D"/>)
 * Strips the leading '#' and ensures 6 characters uppercase.
 */
export function toOpenXmlHexColor(hex: string, fallback: string = '17365D'): string {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '').trim().toUpperCase();
  if (clean.length === 3) {
    return clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length === 6 && /^[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }
  return fallback;
}

/**
 * Standard Available Font Families across Office Suites and Modern Browsers
 */
export const AVAILABLE_FONTS = [
  { id: 'Times New Roman', name: 'Times New Roman (Officiel Institutionnel)' },
  { id: 'Arial', name: 'Arial (Moderne & Standard)' },
  { id: 'Calibri', name: 'Calibri (Standard Microsoft Office)' },
  { id: 'Georgia', name: 'Georgia (Sérif Élégant)' },
  { id: 'Garamond', name: 'Garamond (Classique Académique)' },
  { id: 'Montserrat', name: 'Montserrat (Design Contemporain)' },
];

/**
 * Default System Presets
 */
export const DEFAULT_DOCUMENT_PRESETS: DocumentDesignPreset[] = [
  {
    id: 'preset_infohas_official_cert',
    name: 'Certificat Officiel INFOHAS',
    documentType: 'certificate',
    isDefault: true,
    heading: {
      text: 'ATTESTATION DE SCOLARITE',
      isTextLocked: true, // Official wording must not be casually altered
      textColor: '#17365D', // Institutional Navy
      backgroundColor: 'transparent',
      fontFamily: 'Times New Roman',
      fontSize: 18,
      bold: true,
      italic: false,
      alignment: 'center',
      spacingTop: 12,
      spacingBottom: 16,
      showBottomBorder: true,
      borderColor: '#17365D',
      showSeparatorLine: true,
    },
    footer: {
      text: "INFOHAS — Institut de Formation Professionnelle Privé | Autorisation N° 4/07/1997 | Accréditation N° 25/K0183/DFPP/45\n48 Avenue de France, Agdal, Rabat — Tél: +212 537 77 88 99 | www.infohas.ma",
      textColor: '#475569',
      backgroundColor: 'transparent',
      fontFamily: 'Calibri',
      fontSize: 9,
      alignment: 'center',
      showSeparatorLine: true,
      separatorColor: '#CBD5E1',
      spacingBottom: 8,
      showPageNumber: false,
      contactInfo: 'Directrice de l’établissement : Mme M’Ziouad Imane',
    },
    logo: {
      selectedLogo: 'infohas',
      customLogoUrl: null,
      width: 85,
      height: 85,
      alignment: 'left',
      preserveAspectRatio: true,
    },
    createdAt: '2026-10-16T10:00:00Z',
    updatedAt: '2026-10-16T10:00:00Z',
  },
  {
    id: 'preset_standard_attendance_report',
    name: 'Rapport d’Assiduité Standard',
    documentType: 'attendance_report',
    isDefault: true,
    heading: {
      text: "RAPPORT PÉDAGOGIQUE D'ASSIDUITÉ ET DE SUIVI",
      isTextLocked: false,
      textColor: '#047857', // Emerald 700
      backgroundColor: 'transparent',
      fontFamily: 'Calibri',
      fontSize: 16,
      bold: true,
      italic: false,
      alignment: 'left',
      spacingTop: 10,
      spacingBottom: 14,
      showBottomBorder: true,
      borderColor: '#047857',
      showSeparatorLine: true,
    },
    footer: {
      text: "Document généré par la plateforme INFOHAS Attendance ERP | Système de gestion d'assiduité certifié\nPour toute contestation ou vérification, veuillez vous adresser à la scolarité.",
      textColor: '#64748B',
      backgroundColor: 'transparent',
      fontFamily: 'Calibri',
      fontSize: 8.5,
      alignment: 'center',
      showSeparatorLine: true,
      separatorColor: '#E2E8F0',
      spacingBottom: 6,
      showPageNumber: true,
    },
    logo: {
      selectedLogo: 'infohas',
      customLogoUrl: null,
      width: 80,
      height: 80,
      alignment: 'left',
      preserveAspectRatio: true,
    },
    createdAt: '2026-10-16T10:00:00Z',
    updatedAt: '2026-10-16T10:00:00Z',
  },
  {
    id: 'preset_admin_doc',
    name: 'Document Administratif Général',
    documentType: 'administrative_doc',
    isDefault: true,
    heading: {
      text: 'INFOHAS — DOCUMENT ADMINISTRATIF OFFICIEL',
      isTextLocked: false,
      textColor: '#1E293B', // Slate 800
      backgroundColor: 'transparent',
      fontFamily: 'Arial',
      fontSize: 15,
      bold: true,
      italic: false,
      alignment: 'center',
      spacingTop: 10,
      spacingBottom: 12,
      showBottomBorder: true,
      borderColor: '#94A3B8',
      showSeparatorLine: true,
    },
    footer: {
      text: 'INFOHAS Etablissement de Formation Professionnelle | Tous droits réservés | Document Confidentiel',
      textColor: '#64748B',
      backgroundColor: 'transparent',
      fontFamily: 'Arial',
      fontSize: 8,
      alignment: 'center',
      showSeparatorLine: true,
      separatorColor: '#CBD5E1',
      spacingBottom: 6,
      showPageNumber: true,
    },
    logo: {
      selectedLogo: 'infohas',
      customLogoUrl: null,
      width: 75,
      height: 75,
      alignment: 'left',
      preserveAspectRatio: true,
    },
    createdAt: '2026-10-16T10:00:00Z',
    updatedAt: '2026-10-16T10:00:00Z',
  },
  {
    id: 'preset_custom_institutional',
    name: 'Design Institutionnel Personnalisé',
    documentType: 'certificate',
    isDefault: false,
    heading: {
      text: 'ATTESTATION DE SCOLARITE',
      isTextLocked: false,
      textColor: '#0284C7', // Sky Blue 600
      backgroundColor: 'transparent',
      fontFamily: 'Times New Roman',
      fontSize: 18,
      bold: true,
      italic: false,
      alignment: 'center',
      spacingTop: 12,
      spacingBottom: 16,
      showBottomBorder: true,
      borderColor: '#0284C7',
      showSeparatorLine: true,
    },
    footer: {
      text: "INFOHAS — 48 Avenue de France, Agdal, Rabat | Tél: +212 537 77 88 99 | contact@infohas.ma",
      textColor: '#475569',
      backgroundColor: 'transparent',
      fontFamily: 'Calibri',
      fontSize: 9,
      alignment: 'center',
      showSeparatorLine: true,
      separatorColor: '#0284C7',
      spacingBottom: 8,
      showPageNumber: true,
    },
    logo: {
      selectedLogo: 'infohas',
      customLogoUrl: null,
      width: 85,
      height: 85,
      alignment: 'left',
      preserveAspectRatio: true,
    },
    createdAt: '2026-10-16T10:00:00Z',
    updatedAt: '2026-10-16T10:00:00Z',
  },
];
