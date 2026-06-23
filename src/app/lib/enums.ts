// Canonical string enums — these must match the backend seed-data constants.

export enum DepartmentId {
  CMPE = "dept-computer-engineering",
  EE   = "dept-electrical-engineering",
  ME   = "dept-mechanical-engineering",
  ARCH = "dept-architecture",
  CE   = "dept-civil-engineering",
  IE   = "dept-industrial-engineering",
}

export enum FacultyId {
  Engineering  = "faculty-engineering",
  Architecture = "faculty-architecture",
}

export enum TransferType {
  KURUMLAR_ARASI = "KURUMLAR_ARASI",
  KURUM_ICI      = "KURUM_ICI",
  DGS            = "DGS",
}

// ── Label maps ──────────────────────────────────────────────────────────────

export const DEPARTMENT_LABELS: Record<string, string> = {
  [DepartmentId.CMPE]: "Bilgisayar Mühendisliği",
  [DepartmentId.EE]:   "Elektrik-Elektronik Mühendisliği",
  [DepartmentId.ME]:   "Makine Mühendisliği",
  [DepartmentId.ARCH]: "Mimarlık",
  [DepartmentId.CE]:   "İnşaat Mühendisliği",
  [DepartmentId.IE]:   "Endüstri Mühendisliği",
  // Legacy form values kept for backwards compatibility with existing DB rows
  "computer-eng":   "Bilgisayar Mühendisliği",
  "electrical-eng": "Elektrik-Elektronik Mühendisliği",
  "mechanical-eng": "Makine Mühendisliği",
  "industrial-eng": "Endüstri Mühendisliği",
  "civil-eng":      "İnşaat Mühendisliği",
  "architecture":   "Mimarlık",
};

export const FACULTY_LABELS: Record<string, string> = {
  [FacultyId.Engineering]:  "Mühendislik Fakültesi",
  [FacultyId.Architecture]: "Mimarlık Fakültesi",
};

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  [TransferType.KURUMLAR_ARASI]: "Kurumlar Arası Yatay Geçiş",
  [TransferType.KURUM_ICI]:      "Kurum İçi Yatay Geçiş",
  [TransferType.DGS]:            "Dikey Geçiş (DGS)",
  // Legacy / seed values
  "HORIZONTAL":                  "Kurumlar Arası Yatay Geçiş",
  "VERTICAL":                    "Dikey Geçiş",
  "Kurumlar Arasi Yatay Gecis":  "Kurumlar Arası Yatay Geçiş",
};

/** Which faculty owns a given department. */
export const DEPARTMENT_FACULTY: Record<string, FacultyId> = {
  [DepartmentId.CMPE]: FacultyId.Engineering,
  [DepartmentId.EE]:   FacultyId.Engineering,
  [DepartmentId.ME]:   FacultyId.Engineering,
  [DepartmentId.CE]:   FacultyId.Engineering,
  [DepartmentId.IE]:   FacultyId.Engineering,
  [DepartmentId.ARCH]: FacultyId.Architecture,
};

export function deptLabel(id: string)     { return DEPARTMENT_LABELS[id]    ?? id; }
export function facultyLabel(id: string)  { return FACULTY_LABELS[id]       ?? id; }
export function transferLabel(type: string) { return TRANSFER_TYPE_LABELS[type] ?? type; }
