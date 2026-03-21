export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE_URL || "https://energilink-backend.onrender.com").replace(/\/+$/, "");

export const DEFAULT_DEVICE = "pi4";

export const FIELD_VOLTAGE = "rms_voltage";
export const FIELD_CURRENT = "rms_current";
export const FIELD_POWER = "power";
export const FIELD_POWER_FACTOR = "power_factor";

export const METRIC_VOLTAGE = "vrms";
export const METRIC_CURRENT = "irms";
export const METRIC_POWER = "real_power";
export const METRIC_POWER_FACTOR = "power_factor";

const GRAFANA_DASHBOARD_URL =
  "https://monitoringsystems.grafana.net/public-dashboards/7866b8a55dd04620a214d2b0e9951f84";

export const GRAFANA_PUBLIC_DASHBOARD_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_VOLTAGE_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_CURRENT_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_POWER_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_PF_URL = GRAFANA_DASHBOARD_URL;
