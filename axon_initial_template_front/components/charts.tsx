"use client";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false, loading: () => <div style={{ height: 220 }} /> });

export const HL = "#FF5B00";
export const PALETTE = ["#FF5B00", "#301B69", "#8261D1", "#354ED8", "#B9AEDD"];

const base = (o: ApexOptions = {}): ApexOptions => ({
  chart: { toolbar: { show: false }, fontFamily: "Plus Jakarta Sans Variable, sans-serif", foreColor: "#6E6888", background: "transparent", animations: { speed: 400 }, zoom: { enabled: false } },
  grid: { borderColor: "rgba(48,27,105,.09)", strokeDashArray: 3, padding: { left: 4, right: 8 } },
  dataLabels: { enabled: false },
  legend: { fontSize: "12px", markers: { size: 6 } as never, itemMargin: { horizontal: 10 } },
  tooltip: { theme: "light" },
  ...o,
});

export function LineChart({ categories, series, height = 220, yMax = 100, annotations, colors }: {
  categories: string[]; series: { name: string; data: (number | null)[] }[]; height?: number; yMax?: number; annotations?: ApexOptions["annotations"]; colors?: string[];
}) {
  const opts = base({
    colors: colors ?? [HL, "#301B69", "#8261D1"],
    stroke: { curve: "smooth", width: series.map((_, i) => (i === 0 ? 3 : 2)), dashArray: series.map((_, i) => (i === 0 ? 0 : 5)) },
    markers: { size: 4, strokeWidth: 2, strokeColors: "#fff", hover: { size: 6 } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { min: 0, max: yMax, tickAmount: 4 },
    annotations,
    fill: { type: "solid", opacity: 1 },
  });
  return <Chart type="line" options={opts} series={series} height={height} />;
}

export function AreaChart({ categories, series, height = 220, yMax }: { categories: string[]; series: { name: string; data: number[] }[]; height?: number; yMax?: number }) {
  const opts = base({
    colors: [HL, "#301B69"],
    stroke: { curve: "smooth", width: [3, 2], dashArray: [0, 5] },
    fill: { type: "gradient", gradient: { shadeIntensity: 0, opacityFrom: 0.22, opacityTo: 0, stops: [0, 100] } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { min: 0, max: yMax, tickAmount: 4, labels: { formatter: (v: number) => `${Math.round(v)}${yMax === 100 ? "%" : ""}` } },
    markers: { size: 0, hover: { size: 5 } },
  });
  return <Chart type="area" options={opts} series={series} height={height} />;
}

export function BarChart({ categories, series, height = 240, horizontal = false, colors, stacked = false, yMax, highlightIndex, onSelect }: {
  categories: string[]; series: { name: string; data: number[] }[]; height?: number; horizontal?: boolean; colors?: string[]; stacked?: boolean; yMax?: number; highlightIndex?: number; onSelect?: (i: number) => void;
}) {
  const single = series.length === 1;
  const opts = base({
    colors: colors ?? (single ? [({ dataPointIndex }: { dataPointIndex: number }) => (highlightIndex == null || dataPointIndex === highlightIndex ? HL : "#B9AEDD")] as never : PALETTE),
    chart: { ...base().chart, stacked, events: onSelect ? { dataPointSelection: (_e: unknown, _c: unknown, cfg: { dataPointIndex: number }) => onSelect(cfg.dataPointIndex) } : {} },
    plotOptions: { bar: { horizontal, borderRadius: 5, borderRadiusApplication: "end", columnWidth: "46%", barHeight: "58%" } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, max: horizontal ? yMax : undefined },
    yaxis: { min: horizontal ? undefined : 0, max: horizontal ? undefined : yMax, tickAmount: 4, labels: { formatter: (v: number) => (typeof v === "number" ? String(Math.round(v)) : v) } },
    legend: { show: !single, fontSize: "12px", position: "top", horizontalAlign: "left" },
    states: { hover: { filter: { type: "darken", value: 0.9 } as never } },
  });
  return <Chart type="bar" options={opts} series={series} height={height} />;
}

export function DonutChart({ labels, series, height = 240, colors }: { labels: string[]; series: number[]; height?: number; colors?: string[] }) {
  const opts = base({
    labels,
    colors: colors ?? PALETTE,
    stroke: { width: 2, colors: ["#fff"] },
    legend: { position: "bottom", fontSize: "12px" },
    plotOptions: { pie: { donut: { size: "70%", labels: { show: true, total: { show: true, label: "Open flags", fontSize: "12px", color: "#6E6888", formatter: () => String(series.reduce((a, b) => a + b, 0)) }, value: { fontSize: "26px", fontWeight: 720, color: "#190D38" } } } } },
  });
  return <Chart type="donut" options={opts} series={series} height={height} />;
}
