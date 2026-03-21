export const API_BASE = "http://192.168.110.75:8080";

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

// Kept as aliases so older imports do not break if they still exist somewhere else.
export const GRAFANA_VOLTAGE_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_CURRENT_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_POWER_URL = GRAFANA_DASHBOARD_URL;
export const GRAFANA_PF_URL = GRAFANA_DASHBOARD_URL;