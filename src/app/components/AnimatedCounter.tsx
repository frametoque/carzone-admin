"use client";
import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function AnimatedCounter({ 
  value, 
  currency = false, 
  decimals = 0,
  className = "",
  prefix = "",
  suffix = ""
}: { 
  value: number; 
  currency?: boolean; 
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const spring = useSpring(0, { bounce: 0, duration: 1200 });
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const display = useTransform(spring, (current) => {
    let formatted = "";
    if (currency) {
      formatted = new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      }).format(current);
    } else {
      formatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      }).format(current);
    }
    return `${prefix}${formatted}${suffix}`;
  });

  return <motion.span className={className}>{display}</motion.span>;
}
