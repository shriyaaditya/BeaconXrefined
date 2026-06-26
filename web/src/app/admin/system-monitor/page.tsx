"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface SystemMetrics {
  rabbitmqConnected: boolean;
  redisConnected: boolean;
  postgresConnected: boolean;
  consumerStatus: boolean;
  activeSockets: number;
  queueSize: number;
  messagesPublished: number;
  messagesProcessed: number;
  messagesFailed: number;
}

interface SystemLog {
  timestamp: string;
  service: string;
  event: string;
  status: "success" | "error";
}

export default function SystemMonitorPage() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    rabbitmqConnected: false,
    redisConnected: false,
    postgresConnected: false,
    consumerStatus: false,
    activeSockets: 0,
    queueSize: 0,
    messagesPublished: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
  });
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
    const socket: Socket = io(SOCKET_URL);

    socket.on("system-metrics", (data: SystemMetrics) => {
      setMetrics(data);
    });

    socket.on("system-log", (data: SystemLog) => {
      setLogs((prev) => {
        const newLogs = [...prev, data];
        return newLogs.length > 200 ? newLogs.slice(newLogs.length - 200) : newLogs;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const StatusBadge = ({ label, isOnline }: { label: string; isOnline: boolean }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
      <span className="text-gray-300 font-medium">{label}</span>
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}></div>
        <span className="text-sm text-gray-400">{isOnline ? "Online" : "Offline"}</span>
      </div>
    </div>
  );

  const MetricCard = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-gray-400 text-sm mb-1">{label}</h3>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            System Monitor
          </h1>
          <p className="text-gray-400 mt-2">Real-time infrastructure and pipeline observability.</p>
        </header>

        {/* Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatusBadge label="RabbitMQ" isOnline={metrics.rabbitmqConnected} />
          <StatusBadge label="PostgreSQL" isOnline={metrics.postgresConnected} />
          <StatusBadge label="Redis" isOnline={metrics.redisConnected} />
          <StatusBadge label="Consumer" isOnline={metrics.consumerStatus} />
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard label="Queue Size" value={metrics.queueSize} color="text-blue-400" />
          <MetricCard label="Active WebSockets" value={metrics.activeSockets} color="text-emerald-400" />
          <MetricCard label="Published" value={metrics.messagesPublished} color="text-purple-400" />
          <MetricCard label="Processed" value={metrics.messagesProcessed} color="text-green-400" />
          <MetricCard label="Failed" value={metrics.messagesFailed} color="text-red-400" />
        </div>

        {/* Log Viewer */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col h-96">
          <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-300">Live Pipeline Logs</h2>
            <span className="text-xs text-gray-500 animate-pulse">● Live Stream</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2">
            {logs.length === 0 ? (
              <p className="text-gray-600 italic">Waiting for pipeline events...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex space-x-3 text-gray-300 border-b border-gray-800/50 pb-1">
                  <span className="text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 })}
                  </span>
                  <span className={`font-semibold w-24 shrink-0 ${
                    log.service === 'Simulator' ? 'text-purple-400' :
                    log.service === 'RabbitMQ' ? 'text-blue-400' :
                    log.service === 'PostgreSQL' ? 'text-cyan-400' :
                    log.service === 'Redis' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    [{log.service}]
                  </span>
                  <span className={`flex-1 break-words ${log.status === 'error' ? 'text-red-400 font-medium' : ''}`}>
                    {log.event}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
