import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { opportunitiesApi } from '../../api/opportunities';
import { applicationsApi } from '../../api/applications';
import { usersApi } from '../../api/users';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { motion } from 'framer-motion';
import { resolveUploadUrl } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../hooks/useOrganization';

const MotionDiv = motion.div;
const MotionH1 = motion.h1;
const MotionTr = motion.tr;

export function Pelamar() {
  const { addToast } = useToast();
  const { company, loading: organizationLoading } = useOrganization();
  const companyId = company?.status === 'approved' ? company.id : null;
  const [applicants, setApplicants] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [openingCV, setOpeningCV] = useState(false);
  const [downloadingCV, setDownloadingCV] = useState(false);

  useEffect(() => {
    if (organizationLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    async function fetchApplicants() {
      try {
        const jobsData = await opportunitiesApi.listByCompany(companyId);
        const fetchedJobs = Array.isArray(jobsData) ? jobsData : jobsData.items || [];
        setJobs(fetchedJobs);

        const allApps = [];
        await Promise.all(
          fetchedJobs.map(async (job) => {
            try {
              const appsData = await applicationsApi.listByOpportunity(job.id);
              const apps = appsData.items || [];
              apps.forEach((app) => {
                allApps.push({
                  ...app,
                  jobTitle: job.title,
                  applicantName: app.student
                    ? `${app.student.first_name} ${app.student.last_name}`
                    : `Student #${app.student_id}`,
                });
              });
            } catch (err) {
              console.debug('Failed to load applicants for job', err);
            }
          })
        );
        setApplicants(allApps);
      } catch (err) {
        console.error('Failed to load applicants', err);
      } finally {
        setLoading(false);
      }
    }
    fetchApplicants();
  }, [companyId, organizationLoading]);

  const handleStatusUpdate = async (appId, newStatus) => {
    try {
      await applicationsApi.updateStatus(appId, newStatus);
      setApplicants(
        applicants.map((a) =>
          a.id === appId ? { ...a, status: newStatus } : a
        )
      );
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp({ ...selectedApp, status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const filteredApplicants = selectedJobId
    ? applicants.filter((a) => a.opportunity_id === Number(selectedJobId))
    : applicants;

  const handleViewCV = async (studentId) => {
    setOpeningCV(true);
    try {
      await usersApi.viewUserCV(studentId);
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', message: err.message || 'Gagal membuka CV.' });
    } finally {
      setOpeningCV(false);
    }
  };

  const handleDownloadCV = async (studentId) => {
    setDownloadingCV(true);
    try {
      await usersApi.downloadUserCV(studentId);
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', message: err.message || 'Gagal mengunduh CV.' });
    } finally {
      setDownloadingCV(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  const student = selectedApp?.student;

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <MotionH1 variants={itemVariants} className="text-2xl font-bold text-[#0A1D3D]">Daftar Pelamar</MotionH1>

      <MotionDiv variants={itemVariants} className="flex items-center gap-4">
        <div className="w-64">
          <Select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            options={[
              { value: '', label: 'Semua Lowongan' },
              ...jobs.map((j) => ({ value: String(j.id), label: j.title })),
            ]}
          />
        </div>
        <span className="text-sm text-secondary">
          {filteredApplicants.length} pelamar
        </span>
      </MotionDiv>

      <MotionDiv variants={itemVariants}>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[#0A1D3D]/80 uppercase bg-[#E6ECF5] border-b border-[#E6ECF5]">
                <tr>
                  <th className="px-6 py-3">Nama Pelamar</th>
                  <th className="px-6 py-3">Posisi Dilamar</th>
                  <th className="px-6 py-3">Tanggal Melamar</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplicants.map((app) => (
                  <MotionTr
                    key={app.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    layout
                    className="bg-white border-b border-[#E6ECF5] hover:bg-[#E6ECF5] transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-[#0A1D3D]">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="text-primary hover:underline text-left"
                      >
                        {app.applicantName}
                      </button>
                    </td>
                    <td className="px-6 py-4">{app.jobTitle}</td>
                    <td className="px-6 py-4">
                      {new Date(app.applied_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          app.status === 'Rejected'
                            ? 'error'
                            : app.status === 'Accepted'
                              ? 'success'
                              : 'info'
                        }
                      >
                        {app.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Select
                        value={app.status}
                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                        options={[
                          { value: 'Applied', label: 'Applied' },
                          { value: 'Screening', label: 'Screening' },
                          { value: 'Interview', label: 'Interview' },
                          { value: 'Accepted', label: 'Accepted' },
                          { value: 'Rejected', label: 'Rejected' },
                        ]}
                        className="text-sm w-36"
                      />
                    </td>
                  </MotionTr>
                ))}
                {filteredApplicants.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 text-center text-[#0A1D3D]/50"
                    >
                      Belum ada pelamar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </MotionDiv>

      {/* Applicant Detail Modal */}
      <Modal
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        title="Detail Pelamar"
        size="lg"
      >
        {student && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <img
                src={resolveUploadUrl(student.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${student.first_name} ${student.last_name}`)}&background=0f2854&color=fff`}
                alt={`${student.first_name} ${student.last_name}`}
                className="w-16 h-16 rounded-full bg-[#E6ECF5]"
              />
              <div>
                <h3 className="text-lg font-bold text-[#0A1D3D]">
                  {student.first_name} {student.last_name}
                </h3>
                <p className="text-sm text-secondary">{student.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-secondary">Universitas</span>
                <p className="font-medium">{student.university || '-'}</p>
              </div>
              <div>
                <span className="text-secondary">Jurusan</span>
                <p className="font-medium">{student.major || '-'}</p>
              </div>
              <div>
                <span className="text-secondary">IPK</span>
                <p className="font-medium">{student.gpa || '-'}</p>
              </div>
              <div>
                <span className="text-secondary">Posisi Dilamar</span>
                <p className="font-medium">{selectedApp?.jobTitle}</p>
              </div>
            </div>

            {student.bio && (
              <div>
                <span className="text-sm text-secondary">Bio</span>
                <p className="text-sm mt-1 text-[#0A1D3D]/80">{student.bio}</p>
              </div>
            )}

            {student.has_cv && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewCV(student.id)}
                  disabled={openingCV}
                >
                  {openingCV ? 'Membuka CV...' : 'Lihat CV'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownloadCV(student.id)}
                  disabled={downloadingCV}
                >
                  {downloadingCV ? 'Mengunduh...' : 'Unduh CV'}
                </Button>
              </div>
            )}

            {selectedApp?.history && selectedApp.history.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#0A1D3D]/80 mb-3">Riwayat Status</h4>
                <div className="space-y-3 border-l-2 border-[#E6ECF5] pl-4">
                  {selectedApp.history.map((h, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white" />
                      <p className="text-sm font-medium text-[#0A1D3D]">{h.status}</p>
                      <p className="text-xs text-secondary">
                        {new Date(h.date).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <label className="text-sm font-medium text-[#0A1D3D]/80 mb-1 block">Ubah Status</label>
              <Select
                value={selectedApp?.status}
                onChange={(e) => handleStatusUpdate(selectedApp.id, e.target.value)}
                options={[
                  { value: 'Applied', label: 'Applied' },
                  { value: 'Screening', label: 'Screening' },
                  { value: 'Interview', label: 'Interview' },
                  { value: 'Accepted', label: 'Accepted' },
                  { value: 'Rejected', label: 'Rejected' },
                ]}
                className="w-48"
              />
            </div>
          </div>
        )}
        {!student && selectedApp && (
          <p className="text-secondary text-sm">Data pelamar tidak tersedia.</p>
        )}
      </Modal>
    </MotionDiv>
  );
}
