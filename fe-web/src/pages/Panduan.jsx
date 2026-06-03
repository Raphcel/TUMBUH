import React from 'react';
import {
  BookOpen,
  GraduationCap,
  Compass,
  Award,
  Briefcase,
  FileText,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { useTranslation } from '../context/LanguageContext';

export function Panduan() {
  const { lang } = useTranslation();
  const isId = lang === 'id';
  const steps = [
    {
      title: isId ? 'Tahun 1: Eksplorasi' : 'Year 1: Exploration',
      icon: Compass,
      desc: isId
        ? 'Kenali minatmu dan aktif di organisasi kampus. Jaga IPK tetap tinggi di atas 3.0.'
        : 'Discover your interests and join student organizations (UKM). Keep your GPA high > 3.0.',
      color: 'text-blue-500',
      bg: 'bg-[#E6ECF5]',
    },
    {
      title: isId ? 'Tahun 2: Bangun Keahlian' : 'Year 2: Skill Building',
      icon: BookOpen,
      desc: isId
        ? 'Ambil mata kuliah yang relevan, pelajari hard skill, dan mulai bangun portofolio.'
        : 'Take specific courses, learn hard skills (coding, design, data), and start building a portfolio.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
    {
      title: isId ? 'Tahun 3: Magang' : 'Year 3: Internships',
      icon: Briefcase,
      desc: isId
        ? 'Mulai melamar magang atau externship. Kumpulkan pengalaman nyata dan perluas jaringan.'
        : 'Apply for internships or externships. Get real-world experience and start networking.',
      color: 'text-purple-500',
      bg: 'bg-purple-50',
    },
    {
      title: isId ? 'Tahun 4: Siap Berkarier' : 'Year 4: Career Ready',
      icon: GraduationCap,
      desc: isId
        ? 'Rapikan CV, latihan wawancara, dan lamar posisi full-time atau program lanjutan.'
        : 'Finalize your CV, practice interviews, and apply for full-time positions or graduate programs.',
      color: 'text-orange-500',
      bg: 'bg-orange-50',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, x: 20 },
    visible: { opacity: 1, y: 0, x: 0 }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-primary/5 py-30 px-6 lg:px-8 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold tracking-tight text-primary mb-4"
        >
          {isId ? 'Panduan Karier' : 'Career Handbook'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-lg text-secondary max-w-2xl mx-auto"
        >
          {isId
            ? 'Panduan langkah demi langkah untuk menavigasi perjalanan profesionalmu di IPB University.'
            : 'A step-by-step guide to navigating your professional journey at IPB University.'}
        </motion.p>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 -mt-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16"
        >
          {steps.map((step, idx) => (
            <motion.div key={idx} variants={itemVariants}>
              <Card
                className="border-none shadow-lg shadow-[#E6ECF5]/50 hover:-translate-y-1 transition-transform duration-300 h-full"
              >
                <CardBody className="p-6 text-center h-full flex flex-col items-center">
                  <div
                    className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${step.bg}`}
                  >
                    <step.icon size={28} className={step.color} />
                  </div>
                  <h3 className="font-bold text-primary mb-2 int">{step.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-primary mb-6">
              {isId ? 'Checklist Penting' : 'Essential Checklist'}
            </h2>
            <div className="space-y-4">
              {[
                ...(isId
                  ? [
                      'Buat CV profesional yang ATS-friendly',
                      'Optimalkan profil LinkedIn',
                      'Siapkan template cover letter',
                      'Bangun portofolio website atau drive',
                      'Latihan pertanyaan wawancara umum',
                    ]
                  : [
                      'Create a professional CV (ATS Friendly)',
                      'Optimize LinkedIn Profile',
                      'Prepare Cover Letter Template',
                      'Build a Portfolio Website / Drive',
                      'Practice Common Interview Questions',
                    ]),
              ].map((item, i) => (
                <motion.div key={i} variants={itemVariants}>
                  <div
                    className="flex items-center gap-4 p-4 bg-[#E6ECF5] rounded-xl border border-[#E6ECF5]"
                  >
                    <CheckCircle className="text-accent shrink-0" />
                    <span className="font-medium text-primary">{item}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-[#1E3A8A] to-[#727272] rounded-3xl p-10 text-white relative overflow-hidden"
          >
            <div className="relative z-10">
              <Award size={48} className="text-accent mb-6" />
              <h3 className="text-2xl font-bold mb-4">
                {isId ? 'Mulai perjalananmu hari ini.' : 'Start your journey today.'}
              </h3>
              <p className="text-primary-foreground/80 mb-8 leading-relaxed">
                {isId
                  ? 'Jangan menunggu sampai lulus. Waktu terbaik membangun karier adalah sekarang. Jelajahi lowongan dan lamar peran pertamamu.'
                  : "Don't wait until graduation. The best time to start building your career is now. Browse opportunities and apply to your first role."}
              </p>
              <Button
                to="/lowongan"
                variant="secondary"
                className="border-none shadow-lg shadow-accent/20 font-bold px-8"
              >
                {isId ? 'Lihat Lowongan' : 'Browse Opportunities'} <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Compass size={200} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
