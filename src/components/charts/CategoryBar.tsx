"use client";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";

export function CategoryBar({
  data, labelKey = "name", valueKey = "value", height = 260,
}: { data: { name: string; value: number }[]; labelKey?: string; valueKey?: string; height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tick={{ fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis dataKey={labelKey} type="category" width={70} tick={{ fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              color: "var(--popover-foreground)",
              borderRadius: "var(--radius)",
            }}
          />
          <Bar dataKey={valueKey} fill="var(--primary)" radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}