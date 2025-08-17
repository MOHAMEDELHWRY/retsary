"use client";
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ar } from 'date-fns/locale';
import { format } from 'date-fns';
import { formatEGP } from '@/lib/utils';

export type MonthlyDatum = { monthKey: string; name: string; الأرباح: number; المبيعات: number };

export default function MonthlyBarChart({ data }: { data: MonthlyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `EGP ${value.toLocaleString('en-EG')}`} />
        <Tooltip formatter={(value: number | string, name: string) => [formatEGP(typeof value === 'number' ? value : Number(value)), name]} />
        <Legend />
        <Bar dataKey="المبيعات" fill="#3D5A80" radius={[4, 4, 0, 0]} />
        <Bar dataKey="الأرباح" fill="#98C1D9" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
