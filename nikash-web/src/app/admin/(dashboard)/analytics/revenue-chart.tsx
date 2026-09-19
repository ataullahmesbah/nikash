"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value) => [`৳${Number(value).toLocaleString("en-BD")}`, "আদায়"]}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
        />
        <Bar dataKey="revenue" fill="#2a78d6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
