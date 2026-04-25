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

/**
 * Saves, updates, or clears the note attached to one history table row.
 *
 * If text is empty, the backend should delete/clear the note.
 */
export type SaveHistoryNotePayload = {
  device: string;
  time: string;
  text: string;
  anchor_field?: string;
};

export async function saveHistoryNote(token: string, body: SaveHistoryNotePayload) {
  const res = await fetch(`${API_BASE}/history/note`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      device: body.device,
      time: body.time,
      text: body.text,
      anchor_field: body.anchor_field ?? "power",
    }),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<{
    ok: boolean;
    deleted: boolean;
    note_id: number | null;
    note: string | null;
  }>;
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
  defaultBuildingDesc?: string;
  defaultGrossArea?: string;
  defaultAirconArea?: string;
  defaultOccupants?: string;
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

export type MonthlyBillingRate = {
  year: number;
  month: number;
  cost_per_kwh: number;
  updated_at: string;
};

export type MonthlyBillingRow = {
  year: number;
  month: number;
  month_label: string;
  kwh: number;
  cost_per_kwh?: number | null;
  bill_php?: number | null;
  updated_at?: string | null;
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

export async function getMonthlyBillingRates(
  year: number,
  options?: { device?: string; field?: string }
) {
  const qs = new URLSearchParams({
    year: String(year),
    device: options?.device ?? "pi4",
    field: options?.field ?? "power",
  }).toString();

  const res = await fetch(`${API_BASE}/billing/monthly-rates?${qs}`);
  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<MonthlyBillingRate[]>;
}

export async function saveMonthlyBillingRate(
  token: string,
  body: {
    year: number;
    month: number;
    cost_per_kwh: number;
  },
  options?: { device?: string; field?: string }
) {
  const qs = new URLSearchParams({
    device: options?.device ?? "pi4",
    field: options?.field ?? "power",
  }).toString();

  const res = await fetch(`${API_BASE}/billing/monthly-rates?${qs}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<MonthlyBillingRate>;
}

export async function getMonthlyBillingSummary(params: {
  year: number;
  device?: string;
  field?: string;
}) {
  const qs = new URLSearchParams({
    year: String(params.year),
    device: params.device ?? "pi4",
    field: params.field ?? "power",
  }).toString();

  const res = await fetch(`${API_BASE}/billing/monthly-summary?${qs}`);
  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<MonthlyBillingRow[]>;
}

export async function partialResetReadings(token: string, device?: string) {
  const res = await fetch(`${API_BASE}/admin/reset/readings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(device ? { device } : {}),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  return res.json() as Promise<{
    ok: boolean;
    device?: string | null;
    deleted_realtime_points: number;
    deleted_notes: number;
  }>;
}
