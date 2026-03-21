import { API_BASE } from "../config";

export async function getRealtime(params: { device: string; field: string; limit?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await fetch(`${API_BASE}/public/realtime?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Array<{ time: string; value: number }>>;
}

export async function getNotes(params: { device: string; metric: string; limit?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await fetch(`${API_BASE}/public/notes?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Array<{ id: number; time: string; text: string; author_id: number }>>;
}

export async function signup(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ token: string }>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteNote(token: string, noteId: number) {
  const res = await fetch(`${API_BASE}/notes/${noteId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
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

export async function getReportRecipients() {
  const res = await fetch(`${API_BASE}/reports/settings/recipients`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ReportRecipient[]>;
}

export async function addReportRecipient(email: string) {
  const res = await fetch(`${API_BASE}/reports/settings/recipients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ReportRecipient>;
}

export async function deleteReportRecipient(recipientId: number) {
  const res = await fetch(`${API_BASE}/reports/settings/recipients/${recipientId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean }>;
}

export async function getReportSchedule() {
  const res = await fetch(`${API_BASE}/reports/settings/schedule`);
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ReportSchedule>;
}

export async function sendTestGempReport(recipients?: string[]) {
  const res = await fetch(`${API_BASE}/reports/gemp/send-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipients: recipients ?? [] }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; sent_to: string[] }>;
}