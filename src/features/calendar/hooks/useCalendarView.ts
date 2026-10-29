'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  getMonthDays,
  getMonthRange,
  getNextMonth,
  getPreviousMonth,
  formatMonthYear,
} from '../utils/dateHelpers';

interface UseCalendarViewReturn {
  currentMonth: Date;
  monthDays: Date[];
  monthLabel: string;
  dateRange: { start: string; end: string };
  selectedDate: Date | null;
  goToNextMonth: () => void;
  goToPreviousMonth: () => void;
  goToToday: () => void;
  selectDate: (date: Date | null) => void;
  setMonth: (date: Date) => void;
}

export function useCalendarView(): UseCalendarViewReturn {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Memoized calculations
  const monthDays = useMemo(
    () => getMonthDays(currentMonth),
    [currentMonth]
  );

  const monthLabel = useMemo(
    () => formatMonthYear(currentMonth),
    [currentMonth]
  );

  const dateRange = useMemo(
    () => getMonthRange(currentMonth),
    [currentMonth]
  );

  // Navigation functions
  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => getNextMonth(prev));
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => getPreviousMonth(prev));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

  const selectDate = useCallback((date: Date | null) => {
    setSelectedDate(date);
  }, []);

  const setMonth = useCallback((date: Date) => {
    setCurrentMonth(date);
  }, []);

  return {
    currentMonth,
    monthDays,
    monthLabel,
    dateRange,
    selectedDate,
    goToNextMonth,
    goToPreviousMonth,
    goToToday,
    selectDate,
    setMonth,
  };
}
