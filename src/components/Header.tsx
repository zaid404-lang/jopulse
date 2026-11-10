'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Factory,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  ChevronDown,
  Bell,
  User,
} from 'lucide-react';

export default function Header() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Amman',
        })
      );
      setDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Amman',
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pulse animation on status dot
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Plant<span className="text-emerald-400">Pulse</span>
              </h1>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                Industrial Energy Intelligence
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-800" />

          {/* Plant status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800/60">
              <Factory className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Zarqa Industrial Zone</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800/60">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">EMRC Medium-Industry</span>
            </div>
          </div>
        </div>

        {/* Right: Time & Status */}
        <div className="flex items-center gap-4">
          {/* Live clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex flex-col">
              <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                {time || '--:--:--'}
              </span>
              <span className="text-[10px] text-slate-500">{date || '---'} · AST</span>
            </div>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-red-400'
                } ${pulse ? 'animate-ping' : ''}`}
                style={{ animationDuration: '1s' }}
              />
              <div
                className={`absolute inset-0 w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
            </div>
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className="text-[10px] font-medium text-slate-500 uppercase">
              {isOnline ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Notifications */}
          <button className="relative p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors group">
            <Bell className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors" />
            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
          </button>

          {/* Profile */}
          <button className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-slate-800/60 transition-colors group">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-400 transition-colors" />
          </button>
        </div>
      </div>
    </header>
  );
}
