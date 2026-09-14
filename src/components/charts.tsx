"use client";

/** amCharts wrappers. ChartKey is the colour legend under dashboard graphs. */
import { useLayoutEffect, useRef } from "react";
import type { Root } from "@amcharts/amcharts5";

type Slice = { category: string; value: number; color: string };

export function DonutChart({ data, id }: { data: Slice[]; id: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let disposed = false;
    let root: Root | null = null;
    async function run() {
      const am5 = await import("@amcharts/amcharts5");
      const am5percent = await import("@amcharts/amcharts5/percent");
      const am5themes_Animated = (await import("@amcharts/amcharts5/themes/Animated"))
        .default;
      if (disposed || !ref.current) return;
      root = am5.Root.new(ref.current);
      root.setThemes([am5themes_Animated.new(root)]);
      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          innerRadius: am5.percent(55),
          layout: root.verticalLayout,
        }),
      );
      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: "value",
          categoryField: "category",
        }),
      );
      series.slices.template.adapters.add("fill", (fill, target) => {
        const ctx = target.dataItem?.dataContext as Slice | undefined;
        return ctx ? am5.color(ctx.color) : fill;
      });
      series.labels.template.set("forceHidden", true);
      series.ticks.template.set("forceHidden", true);
      series.data.setAll(data);
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.percent(50),
          x: am5.percent(50),
          marginTop: 12,
          layout: root.gridLayout,
        }),
      );
      legend.labels.template.setAll({ fontSize: 12 });
      legend.valueLabels.template.set("forceHidden", true);
      legend.data.setAll(series.dataItems);
    }
    void run();
    return () => {
      disposed = true;
      root?.dispose();
    };
  }, [data, id]);

  return <div id={id} ref={ref} className="h-80 w-full" />;
}

export function ChartKey({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[12px] text-slate">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({
  data,
  id,
  categoryField,
  valueField,
}: {
  data: Record<string, string | number>[];
  id: string;
  categoryField: string;
  valueField: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let disposed = false;
    let root: Root | null = null;
    async function run() {
      const am5 = await import("@amcharts/amcharts5");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = (await import("@amcharts/amcharts5/themes/Animated"))
        .default;
      if (disposed || !ref.current) return;
      root = am5.Root.new(ref.current);
      root.setThemes([am5themes_Animated.new(root)]);
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          layout: root.verticalLayout,
          panX: false,
          panY: false,
        }),
      );
      const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField,
          renderer: xRenderer,
        }),
      );
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
        }),
      );
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: "Count",
          xAxis,
          yAxis,
          valueYField: valueField,
          categoryXField: categoryField,
        }),
      );
      series.columns.template.setAll({
        fill: am5.color(0x1558d6),
        strokeOpacity: 0,
        cornerRadiusTL: 4,
        cornerRadiusTR: 4,
      });
      xAxis.data.setAll(data);
      series.data.setAll(data);
    }
    void run();
    return () => {
      disposed = true;
      root?.dispose();
    };
  }, [data, id, categoryField, valueField]);

  return <div id={id} ref={ref} className="h-72 w-full" />;
}

export function LineChart({
  data,
  id,
  categoryField,
  valueField,
  seriesName = "Count",
}: {
  data: Record<string, string | number>[];
  id: string;
  categoryField: string;
  valueField: string;
  seriesName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let disposed = false;
    let root: Root | null = null;
    async function run() {
      const am5 = await import("@amcharts/amcharts5");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = (await import("@amcharts/amcharts5/themes/Animated"))
        .default;
      if (disposed || !ref.current) return;
      root = am5.Root.new(ref.current);
      root.setThemes([am5themes_Animated.new(root)]);
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
        }),
      );
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField,
          renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 40 }),
        }),
      );
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          min: 0,
        }),
      );
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: seriesName,
          xAxis,
          yAxis,
          valueYField: valueField,
          categoryXField: categoryField,
          stroke: am5.color(0x1558d6),
        }),
      );
      series.strokes.template.setAll({ strokeWidth: 2 });
      series.fills.template.setAll({
        fill: am5.color(0x1558d6),
        fillOpacity: 0.12,
        visible: true,
      });
      series.bullets.push(() =>
        am5.Bullet.new(root!, {
          sprite: am5.Circle.new(root!, {
            radius: 4,
            fill: am5.color(0xe8b923),
          }),
        }),
      );
      xAxis.data.setAll(data);
      series.data.setAll(data);
    }
    void run();
    return () => {
      disposed = true;
      root?.dispose();
    };
  }, [data, id, categoryField, valueField, seriesName]);

  return <div id={id} ref={ref} className="h-72 w-full" />;
}

export function HorizontalBarChart({
  data,
  id,
  categoryField,
  valueField,
}: {
  data: Record<string, string | number>[];
  id: string;
  categoryField: string;
  valueField: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let disposed = false;
    let root: Root | null = null;
    async function run() {
      const am5 = await import("@amcharts/amcharts5");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = (await import("@amcharts/amcharts5/themes/Animated"))
        .default;
      if (disposed || !ref.current) return;
      root = am5.Root.new(ref.current);
      root.setThemes([am5themes_Animated.new(root)]);
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
        }),
      );
      const yAxis = chart.yAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField,
          renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 20 }),
        }),
      );
      const xAxis = chart.xAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererX.new(root, {}),
          min: 0,
        }),
      );
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: "Count",
          xAxis,
          yAxis,
          valueXField: valueField,
          categoryYField: categoryField,
        }),
      );
      series.columns.template.setAll({
        fill: am5.color(0x1558d6),
        strokeOpacity: 0,
        cornerRadiusTR: 4,
        cornerRadiusBR: 4,
      });
      yAxis.data.setAll(data);
      series.data.setAll(data);
    }
    void run();
    return () => {
      disposed = true;
      root?.dispose();
    };
  }, [data, id, categoryField, valueField]);

  return <div id={id} ref={ref} className="h-72 w-full" />;
}
