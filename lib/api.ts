import { API_BASE } from "../config";

async function readErrorMessage(res: Response) {
  try {
    const data = await res.json();
    return String(data?.detail ?? data?.message ?? `Request failed (${res.status})`);
  } catch {
    try {
      const text = await res.text();
      return text || `Request failed (${res.status})`;
    } catch {
      return `Request failed (${res.status})`;
    }
  }
}

export async function getRealtime(params: { device: string; field: string; limit?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await fetch(`${API_BASE}/public/realtime?${qs}`);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<Array<{ time: string; value: number }>>;
}

export async function getNotes(params: { device: string; metric: string; limit?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await fetch(`${API_BASE}/public/notes?${qs}`);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<
    Array<{
      id: number;
      time: string;
      text: string;
      author_id: number;
      anchor_time?: string | null;
      anchor_value?: number | null;
      anchor_field?: string | null;
      verified?: number;
    }>
  >;
}

export async function signup(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<{ token: string }>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<{ token: string }>;
}

export type CreateNotePayload = {
  device: string;
  metric: string;
  text: string;
  time?: string | null;
  anchor_time?: string | null;
  anchor_value?: number | null;
  anchor_field?: string;
};

export async function createNote(token: string, body: CreateNotePayload) {
  const res = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export async function deleteNote(token: string, noteId: number) {
  const res = await fetch(`${API_BASE}/notes/${noteId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export type ReportRecipient = {
  id: number;
  email: string;
  is_active: number;
  created_at: string;
};

export type ReportSchedule = {
  id: number;
  frequency: "weekly" | "monthly";
  send_time: string;
  day_of_week: number | null;
  day_of_month: number | null;
  enabled: number;
  updated_at: string;
};

export type GempHeader = {
  year?: string;
  agency?: string;
  tel?: string;
  address?: string;
  fax?: string;
  region?: string;
  preparedBy?: string;
  preparedByDesignation?: string;
  notedBy?: string;
  notedByDesignation?: string;
};

export type GempRow = {
  month: string;
  baseline2025?: string | number | null;
  buildingDesc?: string | null;
  grossArea?: string | number | null;
  airconArea?: string | number | null;
  occupants?: string | number | null;
  kwh?: string | number | null;
};

export type GempStats = {
  avgBaseline?: string | number | null;
  avgGrossArea?: string | number | null;
  avgAirconArea?: string | number | null;
  avgOccupants?: string | number | null;
  avgKwh?: string | number | null;
};

export type GempReportPayload = {
  header: GempHeader;
  rows: GempRow[];
  stats: GempStats;
};

export async function getReportRecipients() {
  const res = await fetch(`${API_BASE}/reports/settings/recipients`);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<ReportRecipient[]>;
}

export async function addReportRecipient(email: string) {
  const res = await fetch(`${API_BASE}/reports/settings/recipients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<ReportRecipient>;
}

export async function deleteReportRecipient(recipientId: number) {
  const res = await fetch(`${API_BASE}/reports/settings/recipients/${recipientId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<{ ok: boolean }>;
}

export async function getReportSchedule() {
  const res = await fetch(`${API_BASE}/reports/settings/schedule`);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<ReportSchedule>;
}

export async function updateReportSchedule(body: {
  frequency: "weekly" | "monthly";
  send_time: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  enabled: number;
}) {
  const res = await fetch(`${API_BASE}/reports/settings/schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<ReportSchedule>;
}

export async function getGempReportConfig() {
  const res = await fetch(`${API_BASE}/reports/gemp/config`);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<{
    payload: GempReportPayload;
    updated_at: string;
  }>;
}

export async function saveGempReportConfig(body: GempReportPayload) {
  const res = await fetch(`${API_BASE}/reports/gemp/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<{
    payload: GempReportPayload;
    updated_at: string;
  }>;
}

export async function sendTestGempReport(recipients?: string[]) {
  const res = await fetch(`${API_BASE}/reports/gemp/send-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      recipients && recipients.length ? { recipients } : {}
    ),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<{
    ok: boolean;
    sent_to: string[];
    message?: string;
  }>;
}
