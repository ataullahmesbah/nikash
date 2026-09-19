"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// validated colorblind-safe palette (dataviz skill) — fixed hue order
const C = { blue: "#2a78d6", aqua: "#1baf7a", orange: "#eb6834", violet: "#4a3aa7" };
const GRID = "#e1e0d9";
const AXIS = "#898781";

function bnMonth(m: string) {
  const names = ["জানু","ফেব","মার্চ","এপ্রি","মে","জুন","জুলা","আগ","সেপ্ট","অক্টো","নভে","ডিসে"];
  const idx = Number(m.split("-")[1]) - 1;
  return names[idx] ?? m;
}

export function GrowthChart({ data }: { data: { month: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: bnMonth(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(v) => [`${v} টি`, "নতুন কোম্পানি"]}
          contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 13 }}
        />
        <Area type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} fill="url(#g1)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: { month: string; amount: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: bnMonth(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
        />
        <Tooltip
          formatter={(v) => [`৳${Number(v).toLocaleString("en-BD")}`, "আদায়"]}
          contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 13 }}
        />
        <Bar dataKey="amount" fill={C.aqua} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** পেমেন্ট মাধ্যম অনুযায়ী আদায় — টাকায় দেখায় */
export function MethodDonut({ data }: { data: { name: string; value: number }[] }) {
  const colors = [C.aqua, C.blue, C.orange, C.violet, "#8c8a83"];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, n) => [`৳${Number(v).toLocaleString("en-BD")}`, String(n)]}
          contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 13 }}
        />
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TypeDonut({ data }: { data: { name: string; value: number }[] }) {
  const colors = [C.blue, C.orange, C.violet];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, n) => [`${v} টি`, String(n)]}
          contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 13 }}
        />
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
