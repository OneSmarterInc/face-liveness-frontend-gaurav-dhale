import { useEffect, useRef, useState } from "react";
import "./DatePicker.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDisplayDate(date) {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function toIsoDate(date) {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function DatePicker({ id, value, onChange, placeholder = "Select date", maxDate, minDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const containerRef = useRef(null);

  const selectedDate = value ? new Date(value) : null;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCalendar = () => {
    setViewDate(selectedDate || maxDate || new Date());
    setIsOpen(true);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();

  const years = [];
  const startYear = (minDate ? minDate.getFullYear() : 1930);
  const endYear = (maxDate ? maxDate.getFullYear() : year);
  for (let y = endYear; y >= startYear; y--) years.push(y);

  const isDisabled = (day) => {
    const candidate = new Date(year, month, day);
    if (maxDate && candidate > maxDate) return true;
    if (minDate && candidate < minDate) return true;
    return false;
  };

  const handleSelectDay = (day) => {
    if (isDisabled(day)) return;
    const newDate = new Date(year, month, day);
    onChange(toIsoDate(newDate));
    setIsOpen(false);
  };

  const goToMonth = (delta) => {
    setViewDate(new Date(year, month + delta, 1));
  };

  const handleMonthSelect = (e) => {
    setViewDate(new Date(year, Number(e.target.value), 1));
  };

  const handleYearSelect = (e) => {
    setViewDate(new Date(Number(e.target.value), month, 1));
  };

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<span key={`pad-${i}`} className="datepicker-cell datepicker-cell--empty" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected =
      selectedDate &&
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day;
    cells.push(
      <button
        type="button"
        key={day}
        disabled={isDisabled(day)}
        onClick={() => handleSelectDay(day)}
        className={`datepicker-cell datepicker-day${isSelected ? " datepicker-day--selected" : ""}`}
      >
        {day}
      </button>,
    );
  }

  return (
    <div className="datepicker" ref={containerRef}>
      <input
        id={id}
        type="text"
        readOnly
        value={formatDisplayDate(selectedDate)}
        onClick={openCalendar}
        placeholder={placeholder}
        className="login-input datepicker-input"
        autoComplete="off"
      />
      {isOpen && (
        <div className="datepicker-popover">
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav" onClick={() => goToMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <select className="datepicker-select" value={month} onChange={handleMonthSelect}>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <select className="datepicker-select" value={year} onChange={handleYearSelect}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button type="button" className="datepicker-nav" onClick={() => goToMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="datepicker-weekdays">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d} className="datepicker-weekday">{d}</span>
            ))}
          </div>
          <div className="datepicker-grid">{cells}</div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
