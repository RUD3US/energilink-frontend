import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { API_BASE, DEFAULT_DEVICE, FIELD_POWER } from "../config";

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
  baseline2025?: string;
  buildingDesc?: string;
  grossArea?: string;
  airconArea?: string;
  occupants?: string;
  kwh?: string;
};

export type GempStats = {
  avgBaseline?: string;
  avgGrossArea?: string;
  avgAirconArea?: string;
  avgOccupants?: string;
  avgKwh?: string;
};

export type GempDynamic = {
  device: string;
  field: string;
  archive_interval_hours: number;
  current_month_label: string;
  current_month_days: number;
  points_used_last_30_days: number;
  points_used_current_month: number;
  hours_elapsed_current_month: number;
  last_30_days_kwh: number;
  avg_daily_kwh_30d: number;
  current_month_kwh: number;
  avg_kwh_per_hour_current_month: number;
  projected_month_kwh: number;
  updated_at: string;
};

type GempForm = {
  header: GempHeader;
  rows: GempRow[];
};

type GempStoreState = {
  form: GempForm;
  dynamic: GempDynamic | null;
  loading: boolean;
  error: string;
  initialized: boolean;
  version: number;
};

const STORAGE_KEY = "gemp-report-form-v7";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EMPTY_HEADER: GempHeader = {
  year: String(new Date().getFullYear()),
  agency: "",
  tel: "",
  address: "",
  fax: "",
  region: "",
  defaultBuildingDesc: "",
  defaultGrossArea: "",
  defaultAirconArea: "",
  defaultOccupants: "",
  preparedBy: "",
  preparedByDesignation: "",
  notedBy: "",
  notedByDesignation: "",
};

function createDefaultForm(): GempForm {
  return {
    header: { ...EMPTY_HEADER },
    rows: MONTHS.map((month) => ({
      month,
      baseline2025: "",
      buildingDesc: "",
      grossArea: "",
      airconArea: "",
      occupants: "",
      kwh: "",
    })),
  };
}

function cloneForm(form: GempForm): GempForm {
  return {
    header: { ...form.header },
    rows: form.rows.map((row) => ({ ...row })),
  };
}

function parseNum(v?: string) {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function averageString(values: Array<number | null>, decimals = 2) {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return "";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return avg.toFixed(decimals);
}

function loadFormFromStorage(): GempForm {
  if (typeof window === "undefined") return createDefaultForm();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultForm();

    const parsed = JSON.parse(raw) as Partial<GempForm>;
    const savedRows = Array.isArray(parsed?.rows) ? parsed.rows : [];

    return {
      header: {
        ...EMPTY_HEADER,
        ...(parsed?.header || {}),
      },
      rows: MONTHS.map((month) => {
        const found = savedRows.find((r) => r?.month === month);
        return {
          month,
          baseline2025: found?.baseline2025 ?? "",
          buildingDesc: found?.buildingDesc ?? "",
          grossArea: found?.grossArea ?? "",
          airconArea: found?.airconArea ?? "",
          occupants: found?.occupants ?? "",
          kwh: found?.kwh ?? "",
        };
      }),
    };
  } catch {
    return createDefaultForm();
  }
}

function saveFormToStorage(form: GempForm) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    // ignore
  }
}

let store: GempStoreState = {
  form: createDefaultForm(),
  dynamic: null,
  loading: false,
  error: "",
  initialized: false,
  version: 0,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setStore(partial: Partial<GempStoreState>) {
  store = { ...store, ...partial };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return store;
}

function ensureInitialized() {
  if (store.initialized) return;
  store = {
    ...store,
    form: loadFormFromStorage(),
    initialized: true,
  };
}

function updateForm(nextForm: GempForm) {
  const clean = cloneForm(nextForm);
  saveFormToStorage(clean);
  setStore({
    form: clean,
    version: store.version + 1,
  });
}

async function refreshDynamicInternal() {
  setStore({ loading: true, error: "" });

  try {
    const qs = new URLSearchParams({
      device: DEFAULT_DEVICE,
      field: FIELD_POWER,
    }).toString();

    const res = await fetch(`${API_BASE}/reports/gemp/dynamic?${qs}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = (await res.json()) as GempDynamic;
    setStore({
      dynamic: json,
      loading: false,
      error: "",
    });
  } catch (e: any) {
    setStore({
      loading: false,
      error: String(e?.message ?? e),
    });
  }
}

export function useGempReport() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureInitialized();
    emit();
  }, []);

  useEffect(() => {
    if (!store.dynamic && !store.loading) {
      refreshDynamicInternal();
    }

    const id = setInterval(() => {
      refreshDynamicInternal();
    }, 60 * 1000);

    return () => clearInterval(id);
  }, []);

  const updateHeader = useCallback((patch: Partial<GempHeader>) => {
    updateForm({
      ...store.form,
      header: {
        ...store.form.header,
        ...patch,
      },
    });
  }, []);

  const updateRow = useCallback((index: number, patch: Partial<GempRow>) => {
    updateForm({
      ...store.form,
      rows: store.form.rows.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    });
  }, []);

  const applyDefaultsToAllMonths = useCallback(() => {
    updateForm({
      ...store.form,
      rows: store.form.rows.map((row) => ({
        ...row,
        buildingDesc: row.buildingDesc || store.form.header.defaultBuildingDesc || "",
        grossArea: row.grossArea || store.form.header.defaultGrossArea || "",
        airconArea: row.airconArea || store.form.header.defaultAirconArea || "",
        occupants: row.occupants || store.form.header.defaultOccupants || "",
      })),
    });
  }, []);

  const reset = useCallback(() => {
    const next = createDefaultForm();
    saveFormToStorage(next);

    setStore({
      form: next,
      error: "",
      loading: false,
      version: store.version + 1,
    });
  }, []);

  const refresh = useCallback(async () => {
    await refreshDynamicInternal();
  }, []);

  const report = useMemo(() => {
    const currentMonth =
      state.dynamic?.current_month_label ?? MONTHS[new Date().getMonth()];
    const dynamicCurrentMonthKwh =
      state.dynamic?.current_month_kwh != null
        ? state.dynamic.current_month_kwh.toFixed(2)
        : "";

    const derivedRows = state.form.rows.map((row) => {
      const isCurrentMonth = row.month === currentMonth;
      return {
        ...row,
        kwh: isCurrentMonth ? dynamicCurrentMonthKwh : row.kwh || "",
      };
    });

    return {
      header: { ...state.form.header },
      rows: derivedRows,
    };
  }, [state.form, state.dynamic, state.version]);

  const stats = useMemo<GempStats>(() => {
    return {
      avgBaseline: averageString(report.rows.map((r) => parseNum(r.baseline2025)), 2),
      avgGrossArea: averageString(report.rows.map((r) => parseNum(r.grossArea)), 2),
      avgAirconArea: averageString(report.rows.map((r) => parseNum(r.airconArea)), 2),
      avgOccupants: averageString(report.rows.map((r) => parseNum(r.occupants)), 2),
      avgKwh: averageString(report.rows.map((r) => parseNum(r.kwh)), 2),
    };
  }, [report.rows]);

  return {
    report,
    stats,
    dynamic: state.dynamic,
    loading: state.loading,
    error: state.error,
    version: state.version,
    refresh,
    updateHeader,
    updateRow,
    applyDefaultsToAllMonths,
    reset,
  };
}
