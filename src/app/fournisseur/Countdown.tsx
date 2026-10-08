"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function Countdown({ until }: { until: string }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(until).getTime();
    const tick = () => {
      const seconds = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(seconds);
      if (seconds === 0) router.refresh();
      return seconds;
    };
    tick();
    const timer = setInterval(() => {
      if (tick() === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until, router]);

  if (left === null) return null;
  return (
    <span className="font-mono font-bold">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}
