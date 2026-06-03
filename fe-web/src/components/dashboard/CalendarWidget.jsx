import React, { useState, useMemo } from 'react';
import { format, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { Card, CardBody } from '../ui/Card';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { useCalendarGrid } from '../../hooks/useCalendarGrid';
import { useTranslation } from '../../context/LanguageContext';

/**
 * CalendarWidget
 *
 * Renders a compact month-view calendar with event dots and a schedule list.
 *
 * Props
 * ─────
 * applications  — array of student application objects (from parent's fetch)
 * opportunities — array of HR opportunity objects   (from parent's fetch)
 *
 * Pass exactly one; the other defaults to [].
 * The parent is responsible for fetching — this component does zero API calls.
 */
export function CalendarWidget({ applications = [], opportunities = [] }) {
  const { lang } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate]  = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const copy = lang === 'id'
    ? {
        appliedTitle: 'Melamar',
        deadlineTitle: 'Batas akhir',
        status: 'Status',
        deadlineDesc: 'Batas akhir pendaftaran',
        scheduleFor: 'Jadwal untuk',
        noSchedule: 'Tidak ada jadwal',
        eventDetails: 'Detail Acara',
        at: 'pukul',
        deadline: 'Batas akhir',
        application: 'Lamaran',
      }
    : {
        appliedTitle: 'Applied',
        deadlineTitle: 'Deadline',
        status: 'Status',
        deadlineDesc: 'Application deadline for',
        scheduleFor: 'Schedule for',
        noSchedule: 'No schedule',
        eventDetails: 'Event Details',
        at: 'at',
        deadline: 'Deadline',
        application: 'Application',
      };

  // ── Build calendar events from whichever data source was passed ──────────
  const events = useMemo(() => {
    const calendarEvents = [];

    // Student branch: application dates + deadlines
    applications.forEach((app) => {
      const opp = app.opportunity;
      if (!opp) return;

      calendarEvents.push({
        id:          `app-${app.id}`,
        date:        new Date(app.applied_at),
        title:       `${copy.appliedTitle}: ${opp.title}`,
        type:        'Application',
        time:        format(new Date(app.applied_at), 'HH:mm'),
        location:    opp.company?.name || '-',
        description: `${copy.status}: ${app.status}`,
      });

      if (opp.deadline) {
        calendarEvents.push({
          id:          `deadline-${opp.id}`,
          date:        new Date(opp.deadline),
          title:       `${copy.deadlineTitle}: ${opp.title}`,
          type:        'Deadline',
          time:        '23:59',
          location:    opp.company?.name || '-',
          description: `${copy.deadlineDesc} ${opp.title}`,
        });
      }
    });

    // HR branch: opportunity deadlines
    opportunities.forEach((opp) => {
      if (opp.deadline) {
        calendarEvents.push({
          id:          `deadline-${opp.id}`,
          date:        new Date(opp.deadline),
          title:       `${copy.deadlineTitle}: ${opp.title}`,
          type:        'Deadline',
          time:        '23:59',
          location:    opp.location || '-',
          description: `${copy.deadlineDesc} ${opp.title}`,
        });
      }
    });

    return calendarEvents;
  }, [applications, opportunities, copy.appliedTitle, copy.deadlineDesc, copy.deadlineTitle, copy.status]);

  // ── Calendar grid data ────────────────────────────────────────────────────
  const { weeks, monthStart } = useCalendarGrid(currentMonth);

  // Days-of-week header (derive from first week)
  const DAY_LABELS = weeks[0]?.map((d) => format(d, 'EEE')) ?? [];

  // Events for the selected day
  const selectedEvents = useMemo(
    () => events.filter((e) => isSameDay(e.date, selectedDate)),
    [events, selectedDate]
  );

  return (
    <>
      <Card className="border-[#E6ECF5] shadow-sm flex flex-col overflow-hidden w-full">
        <CardBody className="p-6 flex flex-col">

          {/* ── Header ─────────────────────────────────────── */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <CalendarIcon size={18} />
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-[#E6ECF5] rounded-full text-secondary transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-[#E6ECF5] rounded-full text-secondary transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* ── Day-of-week labels ─────────────────────────── */}
          <div className="grid grid-cols-7 mb-1 bg-[#E6ECF5]/50 rounded-lg">
            {DAY_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-[#0A1D3D]/40 py-2">
                {label}
              </div>
            ))}
          </div>

          {/* ── Month grid ─────────────────────────────────── */}
          <div className="mb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMonth.toString()}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-1"
              >
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day) => {
                      const isSelected      = isSameDay(day, selectedDate);
                      const isCurrentMonth  = isSameMonth(day, monthStart);
                      const hasEvent        = events.some((e) => isSameDay(e.date, day));

                      return (
                        <motion.div
                          key={day.toString()}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className={[
                            'relative aspect-square flex items-center justify-center text-sm rounded-full cursor-pointer transition-colors duration-200',
                            !isCurrentMonth
                              ? 'text-[#0A1D3D]/30'
                              : 'text-[#0A1D3D]/80 hover:bg-[#E6ECF5]',
                            isSelected
                              ? 'bg-primary text-white font-bold shadow-md hover:bg-[#E6ECF5] hover:text-primary'
                              : '',
                            hasEvent && !isSelected ? 'font-semibold text-primary' : '',
                          ].join(' ')}
                          onClick={() => setSelectedDate(day)}
                        >
                          <span>{format(day, 'd')}</span>
                          {hasEvent && !isSelected && (
                            <span className="absolute bottom-1.5 w-1 h-1 bg-accent rounded-full animate-pulse" />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Day schedule ───────────────────────────────── */}
          <div className="mt-auto pt-5 border-t border-[#E6ECF5]">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock size={12} />
              {copy.scheduleFor} {format(selectedDate, 'MMM d, yyyy')}
            </h4>

            <div className="space-y-2 min-h-[100px]">
              <AnimatePresence>
                {selectedEvents.length > 0 ? (
                  selectedEvents.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      onClick={() => setSelectedEvent(event)}
                      className="group flex gap-3 p-2.5 rounded-lg hover:bg-[#E6ECF5] border border-transparent hover:border-[#E6ECF5] transition-all cursor-pointer"
                    >
                      <div
                        className={`w-1 rounded-full ${
                          event.type === 'Deadline'
                            ? 'bg-red-400'
                            : event.type === 'Application'
                            ? 'bg-green-400'
                            : 'bg-accent'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-primary">{event.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-secondary flex items-center gap-1">
                            <Clock size={10} /> {event.time}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              event.type === 'Deadline'
                                ? 'bg-red-50 text-red-600'
                                : event.type === 'Application'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-[#E6ECF5] text-blue-600'
                            }`}
                          >
                            {event.type}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-6 text-[#0A1D3D]/40 border-2 border-dashed border-[#E6ECF5] rounded-lg bg-[#E6ECF5]/50"
                  >
                    <CalendarIcon size={24} className="mb-2 opacity-20" />
                    <p className="text-xs">{copy.noSchedule}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </CardBody>
      </Card>

      {/* ── Event detail modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || copy.eventDetails}
        size="sm"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-secondary">
              <Clock size={16} />
              <span>
                {format(selectedEvent.date, 'EEEE, MMMM d, yyyy')} {copy.at} {selectedEvent.time}
              </span>
            </div>

            {selectedEvent.location && (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <MapPin size={16} />
                <span>{selectedEvent.location}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  selectedEvent.type === 'Deadline'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-[#E6ECF5] text-blue-700'
                }`}
              >
                {selectedEvent.type === 'Deadline' ? copy.deadline : copy.application}
              </span>
            </div>

            {selectedEvent.description && (
              <div className="bg-[#E6ECF5] p-3 rounded-lg text-sm text-[#0A1D3D]/80 whitespace-pre-wrap">
                {selectedEvent.description}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
