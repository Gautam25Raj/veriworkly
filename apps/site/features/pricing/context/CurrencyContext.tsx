"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Currency = "USD" | "INR";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  exchangeRate: number;
  formatPrice: (usdAmount: number, options?: { showDecimal?: boolean }) => string;
  isLoadingRate: boolean;
  detectedRegion: string;
}

const DEFAULT_INR_RATE = 98; // Fallback rate as requested (1 USD = 98 INR)

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  exchangeRate: DEFAULT_INR_RATE,
  formatPrice: (usdAmount) => `$${usdAmount.toFixed(2)}`,
  isLoadingRate: false,
  detectedRegion: "US",
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_INR_RATE);
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(true);
  const [detectedRegion, setDetectedRegion] = useState<string>("US");

  // Adopts the stored preference and locale-detected region once on mount. Both are
  // browser-only values that cannot exist during SSR, so the first render must be the
  // "USD" default and this reconciles afterwards — the one legitimate shape of
  // setState-in-effect, matching the `mounted` pattern used elsewhere in this app.
  useEffect(() => {
    // 1. Check stored user preference
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem("veriworkly_currency") as Currency | null)
        : null;


    // 2. Auto-detect region (India vs Global)
    let isIndia = false;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = navigator.language || "";
      if (
        tz.includes("Kolkata") ||
        tz.includes("Calcutta") ||
        tz.toLowerCase().includes("india") ||
        lang.toLowerCase().includes("-in")
      ) {
        isIndia = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDetectedRegion("IN");
      }
    } catch {
      // ignore detection errors
    }

    if (saved === "USD" || saved === "INR") {
      setCurrencyState(saved);
    } else if (isIndia) {
      setCurrencyState("INR");
    }

    // 3. Fetch real-time live exchange rate with fallback to 98
    const fetchRate = async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates && typeof data.rates.INR === "number" && data.rates.INR > 0) {
            setExchangeRate(data.rates.INR);
          }
        }
      } catch {
        // Use default fallback rate 98
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchRate();
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    if (typeof window !== "undefined") {
      localStorage.setItem("veriworkly_currency", c);
    }
  };

  const formatPrice = (usdAmount: number, options?: { showDecimal?: boolean }): string => {
    if (currency === "INR") {
      const inrValue = Math.round(usdAmount * exchangeRate);
      return `₹${inrValue.toLocaleString("en-IN")}`;
    }
    
    // USD formatting
    if (options?.showDecimal === false && Number.isInteger(usdAmount)) {
      return `$${usdAmount}`;
    }
    return `$${usdAmount.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        exchangeRate,
        formatPrice,
        isLoadingRate,
        detectedRegion,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
