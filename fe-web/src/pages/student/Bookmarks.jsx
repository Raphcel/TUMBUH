import React, { useState, useEffect } from 'react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import {
    Bookmark,
    MapPin,
    Clock,
    Briefcase,
    Search,
    ArrowUpDown,
    Building,
    Loader2,
} from 'lucide-react';
import { bookmarksApi } from '../../api/bookmarks';
import { useTranslation } from '../../context/LanguageContext';
import { CompanyLogo } from '../../components/ui/CompanyLogo';

export function Bookmarks() {
    const { lang } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('deadline');
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const isId = lang === 'id';

    useEffect(() => {
        let cancelled = false;
        async function fetchBookmarks() {
            try {
                const data = await bookmarksApi.mine();
                if (!cancelled) {
                    const mapped = (data.items || []).map((b) => {
                        const opp = b.opportunity || {};
                        const company = opp.company || {};
                        return {
                            id: opp.id,
                            title: opp.title || 'Untitled',
                            company: { name: company.name || 'Unknown', logo: company.logo, id: company.id },
                            location: opp.location || '-',
                            type: opp.type || '-',
                            deadline: opp.deadline,
                            salary: opp.salary || '-',
                            bookmarkedAt: b.created_at,
                        };
                    });
                    setBookmarks(mapped);
                }
            } catch (err) {
                console.error('Failed to load bookmarks', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchBookmarks();
        return () => { cancelled = true; };
    }, []);

    const handleRemoveBookmark = async (opportunityId) => {
        try {
            await bookmarksApi.remove(opportunityId);
            setBookmarks(bookmarks.filter((item) => item.id !== opportunityId));
        } catch (err) {
            console.error('Failed to remove bookmark', err);
        }
    };

    const filteredBookmarks = bookmarks
        .filter((item) => {
            const lowerTerm = searchTerm.toLowerCase();
            return (
                item.title.toLowerCase().includes(lowerTerm) ||
                item.company.name.toLowerCase().includes(lowerTerm)
            );
        })
        .sort((a, b) => {
            if (sortBy === 'deadline') {
                return new Date(a.deadline) - new Date(b.deadline);
            } else if (sortBy === 'title') {
                return a.title.localeCompare(b.title);
            } else if (sortBy === 'company') {
                return a.company.name.localeCompare(b.company.name);
            }
            return 0;
        });

    return (
        <div className="max-w-5xl space-y-8 min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E6ECF5] pb-6">
                <div>
                    <h1 className="text-3xl font-semibold text-primary tracking-tight flex items-center gap-2">
                        <Bookmark className="text-accent fill-current" size={28} /> {isId ? 'Lowongan Tersimpan' : 'Saved Opportunities'}
                    </h1>
                    <p className="text-secondary mt-1 text-lg">
                        {isId ? 'Kelola lowongan dan magang yang kamu simpan.' : 'Manage your bookmarked jobs and internships.'}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-[#E6ECF5] text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                    {loading ? '...' : bookmarks.length} {isId ? 'Item Tersimpan' : 'Saved Items'}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : (
                <>
                    {/* Controls */}
                    <div className="sticky top-4 z-30">
                        <Card className="border-[#E6ECF5] shadow-sm bg-white">
                            <CardBody className="p-4 flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A1D3D]/40" size={18} />
                                    <input
                                        type="text"
                                        placeholder={isId ? 'Cari lowongan tersimpan...' : 'Search saved jobs...'}
                                        className="w-full pl-10 pr-4 py-2 bg-[#E6ECF5] border border-[#E6ECF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2 min-w-50">
                                    <ArrowUpDown size={18} className="text-secondary" />
                                    <select
                                        className="flex-1 p-2 bg-[#E6ECF5] border border-[#E6ECF5] rounded-lg text-sm text-[#0A1D3D]/80 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                    >
                                        <option value="deadline">{isId ? 'Urutkan menurut deadline' : 'Sort by Deadline'}</option>
                                        <option value="title">{isId ? 'Urutkan menurut judul' : 'Sort by Title'}</option>
                                        <option value="company">{isId ? 'Urutkan menurut perusahaan' : 'Sort by Company'}</option>
                                    </select>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* List */}
                    <div className="grid gap-4">
                        {filteredBookmarks.length > 0 ? (
                            filteredBookmarks.map((job) => (
                                <Card
                                    key={job.id}
                                    className="group border border-[#E6ECF5] hover:border-primary/30 transition-all hover:shadow-md"
                                >
                                    <CardBody className="p-6">
                                        <div className="flex flex-col md:flex-row gap-6">
                                            {/* Logo */}
                                            <CompanyLogo
                                                company={job.company}
                                                className="h-16 w-16 rounded-lg border border-[#E6ECF5] bg-[#E6ECF5] p-2"
                                                fallbackClassName="text-xl font-bold text-[#0A1D3D]/40"
                                            />

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-primary group-hover:text-[#1E3A8A] transition-colors">
                                                            <Link to={`/lowongan/${job.id}`}>
                                                                {job.title}
                                                            </Link>
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-primary font-medium mt-1">
                                                            <Building size={14} />
                                                            {job.company.name}
                                                        </div>
                                                    </div>
                                                    <Badge variant={job.type === 'Internship' ? 'info' : 'success'}>
                                                        {job.type}
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-secondary">
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={14} />
                                                        {job.location}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={14} />
                                                        {isId ? 'Deadline' : 'Deadline'}: {new Date(job.deadline).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Briefcase size={14} />
                                                        {job.salary}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-row md:flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-[#E6ECF5] pt-4 md:pt-0 md:pl-6 mt-4 md:mt-0">
                                                <Button
                                                    to={`/lowongan/${job.id}`}
                                                    variant="primary"
                                                    className="whitespace-nowrap w-full md:w-auto text-white justify-center"
                                                >
                                                    {isId ? 'Lamar Sekarang' : 'Apply Now'}
                                                </Button>
                                                <Button
                                                    onClick={() => handleRemoveBookmark(job.id)}
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full md:w-auto justify-center"
                                                >
                                                    {isId ? 'Hapus' : 'Remove'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-[#E6ECF5]/50 rounded-xl border-2 border-dashed border-[#E6ECF5]">
                                <Bookmark className="mx-auto text-[#0A1D3D]/30 mb-4" size={48} />
                                <h3 className="text-lg font-medium text-primary">{isId ? 'Tidak ada bookmark' : 'No bookmarks found'}</h3>
                                <p className="text-secondary mt-1">
                                    {searchTerm
                                        ? (isId ? 'Coba ubah kata kunci pencarianmu.' : 'Try adjusting your search terms.')
                                        : (isId ? 'Kamu belum menyimpan lowongan apa pun.' : "You haven't saved any opportunities yet.")}
                                </p>
                                {!searchTerm && (
                                    <Button to="/lowongan" variant="outline" className="mt-6">
                                        {isId ? 'Lihat Lowongan' : 'Browse Opportunities'}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
