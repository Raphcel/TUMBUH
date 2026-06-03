import React, { useState } from 'react';
import {
    format,
    startOfWeek,
    addDays,
    startOfMonth,
    endOfMonth,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isSameYear,
    isWithinInterval
} from 'date-fns';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal, ModalFooter } from '../components/ui/Modal';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    Plus,
    Trash2,
    X,
    AlignLeft,
    Users,
    Edit2,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
    const [showAddModal, setShowAddModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Mock events state
    const [events, setEvents] = useState([
        {
            id: 1,
            date: new Date(),
            title: 'Weekly Team Sync',
            type: 'Meeting',
            time: '10:00',
            location: 'Zoom',
            description: 'Discussing weekly progress and blockers.',
            invitees: 'team@company.com'
        },
        {
            id: 2,
            date: addDays(new Date(), 2),
            title: 'Submit Q1 Report',
            type: 'Deadline',
            time: '17:00',
            location: 'Drive',
            description: 'Final submission for Q1 financial report.',
            invitees: 'finance@company.com'
        },
        {
            id: 3,
            date: addDays(new Date(), 5),
            title: 'Client Presentation',
            type: 'Meeting',
            time: '14:00',
            location: 'Office',
            description: 'Presenting the new marketing strategy.',
            invitees: 'client@client.com, manager@company.com'
        },
    ]);

    const [newEvent, setNewEvent] = useState({
        title: '',
        type: 'Meeting',
        time: '09:00',
        location: '',
        description: '',
        invitees: ''
    });

    // Helper to get event color style
    const getEventStyle = (type) => {
        switch (type) {
            case 'Deadline': return 'bg-red-50 border-red-100 border-l-red-500 text-red-700';
            case 'Personal': return 'bg-green-50 border-green-100 border-l-green-500 text-green-700';
            case 'Onetime': return 'bg-purple-50 border-purple-100 border-l-purple-500 text-purple-700';
            default: return 'bg-[#E6ECF5] border-blue-100 border-l-blue-500 text-blue-700';
        }
    };

    const getEventBadge = (type) => {
        switch (type) {
            case 'Deadline': return 'bg-red-100 text-red-800';
            case 'Personal': return 'bg-green-100 text-green-800';
            case 'Onetime': return 'bg-purple-100 text-purple-800';
            default: return 'bg-blue-100 text-blue-800';
        }
    };

    const handlePrevious = () => {
        if (viewMode === 'month') {
            setCurrentDate(subMonths(currentDate, 1));
        } else {
            setCurrentDate(addDays(currentDate, -7));
        }
    };

    const handleNext = () => {
        if (viewMode === 'month') {
            setCurrentDate(addMonths(currentDate, 1));
        } else {
            setCurrentDate(addDays(currentDate, 7));
        }
    };

    const handleAddEvent = (e) => {
        e.preventDefault();
        const event = {
            id: Date.now(),
            date: selectedDate,
            ...newEvent
        };
        setEvents([...events, event]);
        setNewEvent({ title: '', type: 'Meeting', time: '09:00', location: '', description: '', invitees: '' });
        setShowAddModal(false);
    };

    const handleUpdateEvent = (e) => {
        e.preventDefault();
        setEvents(events.map(ev => ev.id === selectedEvent.id ? selectedEvent : ev));
        setIsEditing(false);
        setShowViewModal(false);
    };

    const handleDeleteEvent = (id) => {
        setEvents(events.filter(e => e.id !== id));
        setShowViewModal(false);
    };

    const openViewModal = (event) => {
        setSelectedEvent(event);
        setIsEditing(false);
        setShowViewModal(true);
    };

    // Summary Stats
    const todayEvents = events.filter(e => isSameDay(e.date, new Date())).length;
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());
    const upcomingEvents = events.filter(e =>
        isWithinInterval(e.date, { start: weekStart, end: weekEnd }) && e.date >= new Date()
    ).length;

    const renderHeader = () => {
        const dateFormat = viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy';
        const rangeText = viewMode === 'month'
            ? format(currentDate, dateFormat)
            : `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`;

        return (
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">

                    <div className="flex bg-white rounded-lg border border-[#E6ECF5] p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'month' ? 'bg-[#E6ECF5] text-primary' : 'text-secondary hover:text-primary'}`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'week' ? 'bg-[#E6ECF5] text-primary' : 'text-secondary hover:text-primary'}`}
                        >
                            Week
                        </button>
                    </div>

                    <div className="h-6 w-px bg-[#E6ECF5] mx-2 hidden md:block"></div>

                    <h1 className="text-xl font-bold text-primary flex items-center gap-2 min-w-[200px]">
                        <CalendarIcon className="text-accent" size={24} /> {rangeText}
                    </h1>

                    <div className="flex bg-white rounded-lg border border-[#E6ECF5] p-1 shadow-sm ml-2">
                        <button
                            onClick={handlePrevious}
                            className="p-1.5 hover:bg-[#E6ECF5] rounded-md text-secondary transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-3 py-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
                        >
                            Today
                        </button>
                        <button
                            onClick={handleNext}
                            className="p-1.5 hover:bg-[#E6ECF5] rounded-md text-secondary transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <Button
                    variant="primary"
                    onClick={() => {
                        setNewEvent({ title: '', type: 'Meeting', time: '09:00', location: '', description: '', invitees: '' });
                        setShowAddModal(true);
                    }}
                    className="text-white flex items-center gap-2"
                >
                    <Plus size={18} /> Add Event
                </Button>
            </div>
        );
    };

    const renderSummary = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="bg-white p-4 rounded-xl border border-[#E6ECF5] shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-sm text-secondary font-medium">Events Today</p>
                    <p className="text-2xl font-bold text-primary">{todayEvents}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#E6ECF5] flex items-center justify-center text-blue-600">
                    <CalendarIcon size={20} />
                </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E6ECF5] shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-sm text-secondary font-medium">Upcoming This Week</p>
                    <p className="text-2xl font-bold text-primary">{upcomingEvents}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <Clock size={20} />
                </div>
            </div>
        </div>
    );

    const renderWeekView = () => {
        const startDate = startOfWeek(currentDate);
        const days = [];

        for (let i = 0; i < 7; i++) {
            const day = addDays(startDate, i);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const dayEvents = events.filter(e => isSameDay(e.date, day));

            days.push(
                <div key={i} className="flex-1 flex flex-col border-r border-[#E6ECF5] last:border-r-0 min-h-[400px]">
                    <div className={`text-center py-3 border-b border-[#E6ECF5] ${isToday ? 'bg-[#E6ECF5]/30' : 'bg-[#E6ECF5]/30'}`}>
                        <div className="text-xs font-semibold text-secondary uppercase mb-1">{format(day, 'EEE')}</div>
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold cursor-pointer transition-colors
                                ${isToday ? 'bg-primary text-white shadow-md' : 'text-[#0A1D3D]/80 hover:bg-[#E6ECF5]'}
                                ${isSelected && !isToday ? 'bg-primary/10 text-primary' : ''}
                            `}
                            onClick={() => setSelectedDate(day)}
                        >
                            {format(day, 'd')}
                        </div>
                    </div>
                    <div className="flex-1 p-2 space-y-2 group relative hover:bg-[#E6ECF5]/30 transition-colors"
                        onClick={() => setSelectedDate(day)}
                    >
                        {dayEvents.map((event, idx) => (
                            <div
                                key={idx}
                                className={`
                                    text-xs p-2 rounded border border-l-2 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform
                                    ${getEventStyle(event.type)}
                                `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openViewModal(event);
                                }}
                            >
                                <div className="font-semibold mb-0.5">{event.time}</div>
                                <div className="truncate">{event.title}</div>
                            </div>
                        ))}
                        <button
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-[#E6ECF5] rounded text-secondary transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                setShowAddModal(true);
                            }}
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex bg-white rounded-xl border border-[#E6ECF5] overflow-hidden shadow-sm">
                {days}
            </div>
        );
    };

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';

        // Header
        const headerDays = [];
        for (let i = 0; i < 7; i++) {
            headerDays.push(
                <div key={i} className="text-center text-sm font-semibold text-secondary py-4 bg-[#E6ECF5]/50 border-b border-[#E6ECF5]">
                    {format(addDays(startDate, i), 'EEEE')}
                </div>
            );
        }

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                const cloneDay = day;
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isSelected = isSameDay(day, selectedDate);
                const dayEvents = events.filter(e => isSameDay(e.date, day));

                days.push(
                    <div
                        key={day}
                        className={`
              min-h-[120px] p-2 border-r border-b border-[#E6ECF5] transition-colors relative group
              ${!isCurrentMonth ? 'bg-[#E6ECF5]/30 text-[#0A1D3D]/30' : 'bg-white text-[#0A1D3D]/80'}
              ${isSelected ? 'bg-[#E6ECF5]/50' : 'hover:bg-[#E6ECF5]'}
              ${i === 6 ? 'border-r-0' : ''} 
            `}
                        onClick={() => setSelectedDate(cloneDay)}
                    >
                        <span className={`
              text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-2
              ${isSameDay(day, new Date()) ? 'bg-primary text-white shadow-md' : ''}
              ${isSelected && !isSameDay(day, new Date()) ? 'bg-primary/10 text-primary' : ''}
            `}>
                            {formattedDate}
                        </span>

                        <div className="space-y-1.5">
                            {dayEvents.slice(0, 3).map((event, idx) => (
                                <div
                                    key={idx}
                                    className={`
                    text-xs p-1.5 rounded border border-l-2 truncate shadow-sm cursor-pointer hover:scale-[1.02] transition-transform
                    ${getEventStyle(event.type)}
                  `}
                                    title={`${event.time} - ${event.title}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openViewModal(event);
                                    }}
                                >
                                    <span className="font-semibold mr-1">{event.time}</span>
                                    {event.title}
                                </div>
                            ))}
                            {dayEvents.length > 3 && (
                                <div className="text-xs text-center text-secondary font-medium">
                                    +{dayEvents.length - 3} more
                                </div>
                            )}
                        </div>

                        <button
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-[#E6ECF5] rounded text-secondary transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cloneDay);
                                setIsEditing(false);
                                setShowAddModal(true);
                            }}
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day} className="grid grid-cols-7 border-l border-[#E6ECF5]">
                    {days}
                </div>
            );
            days = [];
        }

        return (
            <div className="bg-white rounded-xl border border-[#E6ECF5] overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 border-b border-[#E6ECF5]">
                    {headerDays}
                </div>
                {rows}
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 max-w-7xl mx-auto min-h-screen bg-[#E6ECF5]/30"
        >
            {renderHeader()}

            <AnimatePresence mode="wait">
                <motion.div
                    key={viewMode + currentDate.toString()}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {viewMode === 'month' ? renderMonthView() : renderWeekView()}
                </motion.div>
            </AnimatePresence>

            {renderSummary()}

            {/* ... modals ... */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add New Event"
            >
                {/* ... keep modal content ... */}
                <div className="mb-4">
                    <p className="text-sm text-secondary">
                        For {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                    </p>
                </div>
                <form onSubmit={handleAddEvent} className="space-y-4">
                    <Input
                        label="Event Title"
                        placeholder="e.g. Project Meeting"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Type"
                            value={newEvent.type}
                            onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                            options={[
                                { label: 'Meeting', value: 'Meeting' },
                                { label: 'Deadline', value: 'Deadline' },
                                { label: 'Onetime', value: 'Onetime' },
                                { label: 'Personal', value: 'Personal' }
                            ]}
                        />
                        <Input
                            label="Time"
                            type="time"
                            value={newEvent.time}
                            onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                            required
                        />
                    </div>

                    <Input
                        label="Location (Optional)"
                        placeholder="e.g. Room 302 or Zoom Link"
                        value={newEvent.location}
                        onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    />

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-[#0A1D3D]/80">Description</label>
                        <textarea
                            className="w-full px-3 py-2 text-sm text-[#0A1D3D]/80 border border-[#E6ECF5] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            rows="3"
                            placeholder="Add details..."
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-[#0A1D3D]/80">Invitees (comma separated)</label>
                        <input
                            className="w-full px-3 py-2 text-sm text-[#0A1D3D]/80 border border-[#E6ECF5] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            type="text"
                            placeholder="email1@example.com, email2@example.com"
                            value={newEvent.invitees}
                            onChange={(e) => setNewEvent({ ...newEvent, invitees: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddModal(false)}
                            className="flex-1 justify-center"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1 justify-center text-white"
                        >
                            Create Event
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View/Edit Event Modal */}
            <Modal
                isOpen={showViewModal && !!selectedEvent}
                onClose={() => setShowViewModal(false)}
                title={isEditing ? "Edit Event" : "Event Details"}
                footer={!isEditing && (
                    <button
                        onClick={() => handleDeleteEvent(selectedEvent.id)}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors ml-auto"
                    >
                        <Trash2 size={16} /> Delete Event
                    </button>
                )}
            >
                {selectedEvent && (
                    <>
                        {isEditing ? (
                            <form onSubmit={handleUpdateEvent} className="space-y-4">
                                <Input
                                    label="Event Title"
                                    value={selectedEvent.title}
                                    onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                                    required
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Type"
                                        value={selectedEvent.type}
                                        onChange={(e) => setSelectedEvent({ ...selectedEvent, type: e.target.value })}
                                        options={[
                                            { label: 'Meeting', value: 'Meeting' },
                                            { label: 'Deadline', value: 'Deadline' },
                                            { label: 'Onetime', value: 'Onetime' },
                                            { label: 'Personal', value: 'Personal' }
                                        ]}
                                    />
                                    <Input
                                        label="Time"
                                        type="time"
                                        value={selectedEvent.time}
                                        onChange={(e) => setSelectedEvent({ ...selectedEvent, time: e.target.value })}
                                        required
                                    />
                                </div>
                                <Input
                                    label="Location"
                                    value={selectedEvent.location}
                                    onChange={(e) => setSelectedEvent({ ...selectedEvent, location: e.target.value })}
                                />
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-[#0A1D3D]/80">Description</label>
                                    <textarea
                                        className="w-full px-3 py-2 text-sm text-[#0A1D3D]/80 border border-[#E6ECF5] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        rows="3"
                                        value={selectedEvent.description || ''}
                                        onChange={(e) => setSelectedEvent({ ...selectedEvent, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-[#0A1D3D]/80">Invitees</label>
                                    <input
                                        className="w-full px-3 py-2 text-sm text-[#0A1D3D]/80 border border-[#E6ECF5] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        type="text"
                                        value={selectedEvent.invitees || ''}
                                        onChange={(e) => setSelectedEvent({ ...selectedEvent, invitees: e.target.value })}
                                    />
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsEditing(false)}
                                        className="flex-1 justify-center"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="flex-1 justify-center text-white"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-xl font-bold text-primary mb-1">{selectedEvent.title}</h2>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="p-1.5 text-[#0A1D3D]/40 hover:text-primary transition-colors rounded hover:bg-[#E6ECF5]"
                                            title="Edit Event"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-secondary mt-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getEventBadge(selectedEvent.type)}`}>
                                            {selectedEvent.type}
                                        </span>
                                        <span className="flex items-center gap-1"><Clock size={16} /> {selectedEvent.time}</span>
                                        {selectedEvent.location && (
                                            <span className="flex items-center gap-1"><MapPin size={16} /> {selectedEvent.location}</span>
                                        )}
                                    </div>
                                    <div className="mt-2 text-sm text-[#0A1D3D]/50">
                                        {format(selectedEvent.date, 'EEEE, MMMM do, yyyy')}
                                    </div>
                                </div>

                                {selectedEvent.description && (
                                    <div className="bg-[#E6ECF5] p-3 rounded-lg border border-[#E6ECF5]">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                                            <AlignLeft size={14} /> Description
                                        </div>
                                        <p className="text-sm text-[#0A1D3D]/80 leading-relaxed">
                                            {selectedEvent.description}
                                        </p>
                                    </div>
                                )}

                                {selectedEvent.invitees && (
                                    <div>
                                        <div className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                                            <Users size={14} /> Invitees
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedEvent.invitees.split(',').map((email, i) => (
                                                <span key={i} className="text-xs bg-[#E6ECF5] text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
                                                    {email.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </Modal>
        </motion.div>
    );
}
