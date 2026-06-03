import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  FileUp,
  Link2,
  Loader2,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Save,
  Sparkles,
  Trash2,
  ImageUp,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { AvatarCropModal } from '../../components/profile/AvatarCropModal';
import { resumesApi } from '../../api/resumes';
import { usersApi } from '../../api/users';
import { resolveUploadUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import { buildMajorOptions } from '../../data/ipbMajors';
import { useCloseOnScroll } from '../../hooks/useCloseOnScroll';

function createBlankDraft(user, title = 'CV Draft 1') {
  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  return {
    title,
    template_slug: 'classic',
    personal_info: {
      full_name: fullName,
      headline: user?.major ? `${user.major} Student` : '',
      email: user?.email || '',
      phone: user?.phone || '',
      location: '',
      show_photo: false,
      links: [{ label: 'LinkedIn', url: '' }],
    },
    professional_info: {
      summary: user?.bio || '',
      experiences: [],
      projects: [],
      skills: [],
    },
    education_info: {
      educations: [
        {
          institution: user?.university || 'IPB University',
          degree: '',
          major: user?.major || '',
          start_date: '',
          end_date: '',
          gpa: user?.gpa ? String(user.gpa) : '',
          description: '',
        },
      ],
    },
    organisational_info: {
      organizations: [],
    },
    other_info: {
      certifications: [],
      awards: [],
      languages: [],
      interests: [],
    },
  };
}

function normalizeExperienceItem(item = {}) {
  const legacyDescription = item.description || '';
  return {
    role: item.role || '',
    organization: item.organization || '',
    location: item.location || '',
    start_date: item.start_date || '',
    end_date: item.end_date || '',
    organization_description: item.organization_description || '',
    achievements: Array.isArray(item.achievements)
      ? item.achievements
      : legacyDescription
        ? legacyDescription.split('\n').map((line) => line.trim()).filter(Boolean)
        : [],
  };
}

function normalizeResumeForEditor(resume) {
  return {
    id: resume.id,
    title: resume.title || 'CV Draft',
    template_slug: 'classic',
    personal_info: {
      full_name: resume.personal_info?.full_name || '',
      headline: resume.personal_info?.headline || '',
      email: resume.personal_info?.email || '',
      phone: resume.personal_info?.phone || '',
      location: resume.personal_info?.location || '',
      show_photo: resume.personal_info?.show_photo ?? false,
      links: resume.personal_info?.links?.length ? resume.personal_info.links : [{ label: 'LinkedIn', url: '' }],
    },
    professional_info: {
      summary: resume.professional_info?.summary || '',
      experiences: (resume.professional_info?.experiences || []).map(normalizeExperienceItem),
      projects: resume.professional_info?.projects || [],
      skills: resume.professional_info?.skills || [],
    },
    education_info: {
      educations: resume.education_info?.educations || [],
    },
    organisational_info: {
      organizations: resume.organisational_info?.organizations || [],
    },
    other_info: {
      certifications: resume.other_info?.certifications || [],
      awards: resume.other_info?.awards || [],
      languages: resume.other_info?.languages || [],
      interests: resume.other_info?.interests || [],
    },
    created_at: resume.created_at,
    updated_at: resume.updated_at,
  };
}

function sanitizeFileName(value) {
  return (value || 'cv')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cv';
}

const UNSAFE_CSS_TOKENS = ['oklch(', 'lch(', 'lab(', 'color(', 'color-mix(', 'light-dark(', 'device-cmyk('];

function containsUnsafeCssValue(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return UNSAFE_CSS_TOKENS.some((token) => lower.includes(token));
}

function getPropertyFallback(propertyName) {
  if (/shadow/i.test(propertyName)) return 'none';
  if (/filter/i.test(propertyName)) return 'none';
  if (/background-image/i.test(propertyName)) return 'none';
  if (/mask/i.test(propertyName)) return 'none';
  if (/outline-color|border.*color|column-rule-color/i.test(propertyName)) return 'transparent';
  if (/(^|-)color$/i.test(propertyName)) return '#000000';
  return '';
}

function normalizeStyleValue(converter, propertyName, value) {
  if (!value || !containsUnsafeCssValue(value)) return value;

  converter.style.setProperty(propertyName, value);
  const normalized = (window.getComputedStyle(converter).getPropertyValue(propertyName) || '').trim();
  converter.style.removeProperty(propertyName);

  if (normalized && !containsUnsafeCssValue(normalized)) {
    return normalized;
  }

  const fallback = getPropertyFallback(propertyName);
  if (fallback) {
    return fallback;
  }

  return '';
}

function inlineComputedStyles(sourceNode, targetNode, converter) {
  if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) return;

  const computed = window.getComputedStyle(sourceNode);
  for (const propertyName of computed) {
    if (propertyName.startsWith('--')) continue;

    const value = normalizeStyleValue(
      converter,
      propertyName,
      computed.getPropertyValue(propertyName)
    );

    targetNode.style.setProperty(
      propertyName,
      value,
      computed.getPropertyPriority(propertyName)
    );
  }

  targetNode.removeAttribute('class');

  if (sourceNode instanceof HTMLImageElement && targetNode instanceof HTMLImageElement) {
    targetNode.crossOrigin = 'anonymous';
    targetNode.referrerPolicy = 'no-referrer';
  }

  const sourceChildren = Array.from(sourceNode.children);
  const targetChildren = Array.from(targetNode.children);
  for (let index = 0; index < sourceChildren.length; index += 1) {
    inlineComputedStyles(sourceChildren[index], targetChildren[index], converter);
  }
}

function sanitizeInlineStyles(node) {
  if (!(node instanceof Element)) return;

  for (let index = node.style.length - 1; index >= 0; index -= 1) {
    const propertyName = node.style[index];
    const value = node.style.getPropertyValue(propertyName);
    if (!containsUnsafeCssValue(value)) continue;

    const fallback = getPropertyFallback(propertyName);

    if (fallback) {
      node.style.setProperty(propertyName, fallback, node.style.getPropertyPriority(propertyName));
    } else {
      node.style.removeProperty(propertyName);
    }
  }

  Array.from(node.children).forEach((child) => sanitizeInlineStyles(child));
}

function createPdfExportClone(element) {
  const clone = element.cloneNode(true);
  const rect = element.getBoundingClientRect();
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-100000px';
  wrapper.style.top = '0';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.opacity = '0';
  wrapper.style.background = '#ffffff';
  wrapper.style.padding = '0';
  wrapper.style.margin = '0';
  wrapper.style.width = `${Math.ceil(rect.width)}px`;

  const converter = document.createElement('div');
  converter.setAttribute('aria-hidden', 'true');
  converter.style.position = 'absolute';
  converter.style.left = '-100000px';
  converter.style.top = '0';
  converter.style.visibility = 'hidden';
  wrapper.appendChild(converter);

  inlineComputedStyles(element, clone, converter);
  sanitizeInlineStyles(clone);

  clone.style.width = `${Math.ceil(rect.width)}px`;
  clone.style.maxWidth = 'none';
  clone.style.margin = '0';
  clone.style.transform = 'none';

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return { wrapper, clone };
}

function stripCloneDocumentStyles(clonedDocument) {
  clonedDocument.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    node.remove();
  });
}

async function generatePdfFromElement(element) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const { wrapper, clone } = createPdfExportClone(element);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDocument) => {
        stripCloneDocumentStyles(clonedDocument);
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pdfWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imageWidth, imageHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imageWidth, imageHeight);
      heightLeft -= pdfHeight;
    }

    return pdf.output('blob');
  } finally {
    wrapper.remove();
  }
}

function formatTimestamp(value, locale) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatMonthValue(value, locale) {
  if (!value) return '-';
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

function sectionTitleMap(isId) {
  return {
    personal: isId ? 'Informasi' : 'Information',
    experience: isId ? 'Pengalaman' : 'Experience',
    education: isId ? 'Pendidikan' : 'Education',
    skills: isId ? 'Keterampilan' : 'Skills',
    projects: isId ? 'Proyek' : 'Projects',
    certifications: isId ? 'Sertifikat' : 'Certificates',
    preview: isId ? 'Preview' : 'Preview',
  };
}

function buildTabs(isId) {
  const labels = sectionTitleMap(isId);
  return [
    { key: 'personal', label: labels.personal },
    { key: 'experience', label: labels.experience },
    { key: 'education', label: labels.education },
    { key: 'skills', label: labels.skills },
    { key: 'projects', label: labels.projects },
    { key: 'certifications', label: labels.certifications },
    { key: 'preview', label: labels.preview },
  ];
}

function buildWarnings(draftForm, isId) {
  if (!draftForm) return [];

  const warnings = [];
  if (!draftForm.personal_info.full_name.trim()) warnings.push(isId ? 'Nama lengkap belum diisi.' : 'Full name is missing.');
  if (!draftForm.personal_info.email.trim()) warnings.push(isId ? 'Email belum diisi.' : 'Email is missing.');
  if (!draftForm.professional_info.summary.trim()) warnings.push(isId ? 'Ringkasan profesional masih kosong.' : 'Professional summary is empty.');
  if (!draftForm.professional_info.skills.length) warnings.push(isId ? 'Tambahkan minimal satu keterampilan inti.' : 'Add at least one core skill.');
  if (!draftForm.education_info.educations.length) warnings.push(isId ? 'Tambahkan riwayat pendidikan.' : 'Add at least one education entry.');
  return warnings;
}

function updateAtIndex(items, index, nextItem) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function removeAtIndex(items, index) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function normalizeMultilineItems(value = '') {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildBulletTextareaValue(items = []) {
  return items
    .map((line) => (line ? `• ${line}` : ''))
    .join('\n');
}

function parseBulletTextareaValue(value = '') {
  return value.split('\n').map((line) => line.replace(/^\s*[•*-]?\s?/, ''));
}

function sanitizeDraftPayload(draftForm) {
  return {
    title: draftForm.title,
    template_slug: 'classic',
    personal_info: draftForm.personal_info,
    professional_info: {
      ...draftForm.professional_info,
      experiences: draftForm.professional_info.experiences.map((item) => ({
        ...item,
        achievements: normalizeMultilineItems((item.achievements || []).join('\n')),
      })),
    },
    education_info: draftForm.education_info,
    organisational_info: draftForm.organisational_info,
    other_info: draftForm.other_info,
  };
}

function SectionIntro({ title, description }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="max-w-[56ch] text-sm leading-6 text-[#0A1D3D]/50">{description}</p>
    </div>
  );
}

function FieldGroup({ children, columns = 'one' }) {
  const classes = columns === 'two'
    ? 'grid gap-4 md:grid-cols-2'
    : columns === 'three'
      ? 'grid gap-4 md:grid-cols-3'
      : columns === 'four'
        ? 'grid gap-4 md:grid-cols-4'
        : 'space-y-4';

  return <div className={classes}>{children}</div>;
}

function TextareaField({ label, helper, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">{label}</label>}
      <textarea
        className={`min-h-[120px] w-full rounded-xl border border-[#E6ECF5] bg-white px-4 py-3 text-sm text-[#0A1D3D] shadow-sm transition-colors focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 ${className}`}
        {...props}
      />
      {helper && <p className="mt-2 text-xs text-[#0A1D3D]/50">{helper}</p>}
    </div>
  );
}

function DraftPill({ children, tone = 'neutral' }) {
  const toneClass = tone === 'accent'
    ? 'bg-[#E6ECF5] text-[#1E3A8A]'
    : 'bg-[#E6ECF5] text-[#0A1D3D]/60';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {children}
    </span>
  );
}

function PreviewSection({ title, children }) {
  if (!children) return null;

  return (
    <section className="space-y-3">
      <div className="border-t border-[#E6ECF5] pt-8">
        <h3 className="text-xs font-bold uppercase tracking-[0.32em] text-[#0A1D3D]/50">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function CVPreview({ draft, user, locale }) {
  const personal = draft.personal_info;
  const professional = draft.professional_info;
  const education = draft.education_info;
  const organisational = draft.organisational_info;
  const other = draft.other_info;
  const avatarUrl = personal.show_photo ? resolveUploadUrl(user?.avatar) : null;
  const contactItems = [
    { key: 'email', value: personal.email, icon: Mail },
    { key: 'phone', value: personal.phone, icon: Phone },
    { key: 'location', value: personal.location, icon: MapPin },
  ].filter((item) => item.value);
  return (
    <div className="mx-auto" style={{ width: `${A4_WIDTH}px` }}>
      <div className="border border-[#E6ECF5] bg-white p-10 shadow-sm" style={{ minHeight: `${A4_HEIGHT}px` }}>
        <div className="space-y-8">
          <header className="space-y-5">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-3">
                <div className="space-y-2">
                  <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">
                    {personal.full_name || 'Your Name'}
                  </h1>
                  <p className="text-[14px] text-[#0A1D3D]/50">
                    {personal.headline || 'Professional headline'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#0A1D3D]/60">
                  {contactItems.map(({ key, value, icon }) => (
                    <span key={key} className="inline-flex items-center gap-2">
                      {React.createElement(icon, { size: 15, className: 'text-[#0A1D3D]/40' })}
                      {value}
                    </span>
                  ))}
                </div>

                {personal.links.length > 0 && (
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#0A1D3D]/60">
                    {personal.links
                      .filter((item) => item.url || item.label)
                      .map((item, index) => (
                        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
                          <Link2 size={15} className="text-[#0A1D3D]/40" />
                          {item.url || item.label}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt=""
                  className="hidden h-20 w-20 rounded-xl object-cover md:block"
                />
              )}
            </div>
          </header>

          <PreviewSection title="Profil">
            <p className="text-[12px] leading-6 text-[#0A1D3D]/80">
              {professional.summary || 'Add a short profile summary here.'}
            </p>
          </PreviewSection>

          {!!professional.experiences.length && (
            <PreviewSection title="Pengalaman">
              <div className="space-y-6">
                {professional.experiences.map((item, index) => (
                  <div key={`experience-preview-${index}`} className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#0A1D3D]">{item.role || 'Role'}</h4>
                        <p className="text-[12px] text-[#0A1D3D]/60">{item.organization || 'Organization'}</p>
                      </div>
                      <p className="text-[12px] text-[#0A1D3D]/50">
                        {[item.start_date, item.end_date].filter(Boolean).map((value) => formatMonthValue(value, locale)).join(' - ') || '-'}
                      </p>
                    </div>
                    {item.organization_description && (
                      <p className="text-[12px] leading-6 text-[#0A1D3D]/80">{item.organization_description}</p>
                    )}
                    {!!item.achievements?.length && (
                      <ul className="list-disc space-y-1 pl-5 text-[12px] leading-6 text-[#0A1D3D]/80">
                        {item.achievements.filter((line) => line.trim()).map((line, lineIndex) => (
                          <li key={`${index}-${lineIndex}`}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </PreviewSection>
          )}

          {!!education.educations.length && (
            <PreviewSection title="Pendidikan">
              <div className="space-y-7">
                {education.educations.map((item, index) => (
                  <div key={`education-preview-${index}`} className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#0A1D3D]">{item.institution || 'Institution'}</h4>
                        <p className="text-[12px] text-[#0A1D3D]/60">{[item.degree, item.major].filter(Boolean).join(', ') || '-'}</p>
                      </div>
                      <p className="text-[12px] text-[#0A1D3D]/50">
                        {[item.start_date, item.end_date].filter(Boolean).map((value) => formatMonthValue(value, locale)).join(' - ') || '-'}
                      </p>
                    </div>
                    {item.gpa && <p className="text-[12px] text-[#0A1D3D]/60">GPA {item.gpa}</p>}
                    {item.description && <p className="text-[12px] leading-6 text-[#0A1D3D]/80">{item.description}</p>}
                  </div>
                ))}
              </div>
            </PreviewSection>
          )}

          {(professional.skills.length > 0 || professional.projects.length > 0) && (
            <PreviewSection title="Keterampilan & Proyek">
              <div className="space-y-8">
                {!!professional.skills.length && (
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Keterampilan</h4>
                    <div className="flex flex-wrap gap-2">
                      {professional.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-[#E6ECF5] px-3 py-1.5 text-[11px] font-medium text-[#0A1D3D]/80">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!!professional.projects.length && (
                  <div className="space-y-5">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Proyek</h4>
                    {professional.projects.map((item, index) => (
                      <div key={`project-preview-${index}`} className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h5 className="text-[13px] font-semibold text-[#0A1D3D]">{item.name || 'Project'}</h5>
                            {item.role && <p className="text-[12px] text-[#0A1D3D]/60">{item.role}</p>}
                          </div>
                          {item.link && <p className="text-[11px] text-[#0A1D3D]/50">{item.link}</p>}
                        </div>
                        {item.description && <p className="text-[12px] leading-6 text-[#0A1D3D]/80">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PreviewSection>
          )}

          {(organisational.organizations.length > 0 || other.certifications.length > 0 || other.awards.length > 0 || other.languages.length > 0 || other.interests.length > 0) && (
            <PreviewSection title="Tambahan">
              <div className="space-y-8">
                {!!organisational.organizations.length && (
                  <div className="space-y-4">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Organisasi</h4>
                    {organisational.organizations.map((item, index) => (
                      <div key={`organization-preview-${index}`} className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h5 className="text-[13px] font-semibold text-[#0A1D3D]">{item.name || 'Organization'}</h5>
                            <p className="text-[12px] text-[#0A1D3D]/60">{item.role || '-'}</p>
                          </div>
                          <p className="text-[12px] text-[#0A1D3D]/50">{[item.start_date, item.end_date].filter(Boolean).map((value) => formatMonthValue(value, locale)).join(' - ') || '-'}</p>
                        </div>
                        {item.description && <p className="text-[12px] leading-6 text-[#0A1D3D]/80">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {!!other.certifications.length && (
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Sertifikasi</h4>
                    <div className="space-y-2 text-[12px] text-[#0A1D3D]/80">
                      {other.certifications.map((item, index) => (
                        <p key={`certification-preview-${index}`}>
                          {item.name || 'Certification'}
                          {item.issuer ? ` · ${item.issuer}` : ''}
                          {item.year ? ` (${item.year})` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {!!other.awards.length && (
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Penghargaan</h4>
                    <div className="space-y-2 text-[12px] text-[#0A1D3D]/80">
                      {other.awards.map((item, index) => (
                        <p key={`award-preview-${index}`}>
                          {item.name || 'Award'}
                          {item.issuer ? ` · ${item.issuer}` : ''}
                          {item.year ? ` (${item.year})` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {!!other.languages.length && (
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Bahasa</h4>
                    <div className="space-y-2 text-[12px] text-[#0A1D3D]/80">
                      {other.languages.map((item, index) => (
                        <p key={`language-preview-${index}`}>
                          {item.name || 'Language'}
                          {item.proficiency ? ` · ${item.proficiency}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {!!other.interests.length && (
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-[#0A1D3D]">Minat</h4>
                    <p className="text-[12px] text-[#0A1D3D]/80">{other.interests.join(', ')}</p>
                  </div>
                )}
              </div>
            </PreviewSection>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryCard({ title, subtitle, onRemove, children, collapsible = false, expanded = true, onToggle }) {
  return (
    <div className="rounded-xl border border-[#E6ECF5] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button
            type={collapsible ? 'button' : undefined}
            onClick={collapsible ? onToggle : undefined}
            className={`flex w-full items-start justify-between gap-3 text-left ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[#0A1D3D]">{title}</h4>
              {subtitle && <p className="mt-1 text-xs leading-5 text-[#0A1D3D]/50">{subtitle}</p>}
            </div>
            {collapsible && (
              <ChevronDown
                size={16}
                className={`mt-0.5 shrink-0 text-[#0A1D3D]/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6ECF5] text-[#0A1D3D]/40 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {(!collapsible || expanded) && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

function AddRowButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-[#E6ECF5] bg-white px-3.5 py-2 text-sm font-medium text-[#0A1D3D]/80 transition-colors hover:border-[#E6ECF5] hover:bg-[#E6ECF5]"
    >
      <FilePlus2 size={15} />
      {label}
    </button>
  );
}

function EditorPanel({ children }) {
  return (
    <div className="rounded-xl border border-[#E6ECF5] bg-white p-5 shadow-sm md:p-6">
      {children}
    </div>
  );
}

function DraftLibraryCard({ draft, isId, onOpen, onDelete }) {
  return (
    <div className="group rounded-xl border border-[#E6ECF5] bg-white p-5 shadow-sm transition-all hover:-translate-y-[1px] hover:border-[#E6ECF5]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <DraftPill tone="accent">{isId ? 'Klasik' : 'Classic'}</DraftPill>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">{draft.title}</h3>
            <p className="text-sm text-[#0A1D3D]/50">
              {isId ? 'Terakhir disimpan' : 'Last saved'} {formatTimestamp(draft.updated_at, isId ? 'id-ID' : 'en-US')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(draft)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6ECF5] text-[#0A1D3D]/40 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-[#0A1D3D]/50">
          <FileText size={16} />
          <span>{isId ? 'Draft CV aktif' : 'Structured CV draft'}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(draft)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A1D3D]"
        >
          {isId ? 'Buka Editor' : 'Open Editor'}
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
    </div>
  );
}

export function CVBuilder() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { lang } = useTranslation();
  const isId = lang === 'id';
  const locale = isId ? 'id-ID' : 'en-US';
  const previewRef = useRef(null);
  const previewViewportRef = useRef(null);
  const avatarInputRef = useRef(null);
  const actionsMenuRef = useRef(null);

  const tabs = useMemo(() => buildTabs(isId), [isId]);

  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [draftForm, setDraftForm] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState(null);
  const [expandedExperiences, setExpandedExperiences] = useState({});
  const [actionsOpen, setActionsOpen] = useState(false);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [previewScale, setPreviewScale] = useState(1);
  useCloseOnScroll(actionsOpen, () => setActionsOpen(false));

  const isDirty = useMemo(
    () => draftForm && JSON.stringify(draftForm) !== savedSnapshot,
    [draftForm, savedSnapshot]
  );

  const currentDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) || null,
    [drafts, selectedDraftId]
  );

  const warnings = useMemo(() => buildWarnings(draftForm, isId), [draftForm, isId]);

  const hydrateDraft = (resume) => {
    const normalized = normalizeResumeForEditor(resume);
    setSelectedDraftId(normalized.id);
    setDraftForm(normalized);
    setSavedSnapshot(JSON.stringify(normalized));
    setExpandedExperiences({});
  };

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const data = await resumesApi.listMine();
      setDrafts(data);
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal memuat draft CV.' : 'Failed to load CV drafts.'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!actionsMenuRef.current?.contains(event.target)) {
        setActionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!previewRef.current && !previewViewportRef.current) return undefined;

    const updatePreviewMetrics = () => {
      if (previewRef.current) {
        const nextPageCount = Math.max(1, Math.ceil(previewRef.current.scrollHeight / A4_HEIGHT));
        setPreviewPageCount((prev) => (prev === nextPageCount ? prev : nextPageCount));
      }

      if (previewViewportRef.current) {
        const nextScale = Math.min(
          1,
          previewViewportRef.current.getBoundingClientRect().width / A4_WIDTH
        );
        const safeScale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;
        setPreviewScale((prev) => (Math.abs(prev - safeScale) < 0.001 ? prev : safeScale));
      }
    };

    updatePreviewMetrics();

    const observer = new ResizeObserver(updatePreviewMetrics);
    if (previewRef.current) observer.observe(previewRef.current);
    if (previewViewportRef.current) observer.observe(previewViewportRef.current);

    return () => observer.disconnect();
  }, [draftForm, selectedDraftId]);

  const updateDraftForm = (updater) => {
    setDraftForm((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const saveCurrentDraft = async ({ silent = false } = {}) => {
    if (!draftForm?.id) return null;
    setSaving(true);
    try {
      const payload = sanitizeDraftPayload(draftForm);

      const updated = await resumesApi.update(draftForm.id, payload);
      setDrafts((prev) => prev
        .map((draft) => (draft.id === updated.id ? updated : draft))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));

      const normalized = normalizeResumeForEditor(updated);
      setDraftForm(normalized);
      setSavedSnapshot(JSON.stringify(normalized));

      if (!silent) {
        addToast({
          type: 'success',
          title: isId ? 'Tersimpan' : 'Saved',
          message: isId ? 'Draft CV berhasil disimpan.' : 'CV draft saved successfully.',
        });
      }

      return normalized;
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menyimpan draft CV.' : 'Failed to save CV draft.'),
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const ensureDraftSaved = async () => {
    if (isDirty) {
      return saveCurrentDraft({ silent: true });
    }
    return draftForm;
  };

  const handleOpenDraft = (draft) => {
    hydrateDraft(draft);
    setActiveTab('personal');
  };

  const handleBackToLibrary = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        isId
          ? 'Ada perubahan yang belum disimpan. Kembali ke daftar draft dan buang perubahan?'
          : 'You have unsaved changes. Return to the draft list and discard them?'
      );
      if (!confirmed) return;
    }

    setSelectedDraftId(null);
    setDraftForm(null);
    setSavedSnapshot('');
    setActiveTab('personal');
  };

  const handleCreateDraft = async () => {
    if (drafts.length >= 2) {
      addToast({
        type: 'error',
        title: isId ? 'Batas draft' : 'Draft limit',
        message: isId ? 'Maksimal 2 draft CV untuk saat ini.' : 'You can only keep 2 CV drafts for now.',
      });
      return;
    }

    setCreating(true);
    try {
      const created = await resumesApi.create(createBlankDraft(user, `CV Draft ${drafts.length + 1}`));
      setDrafts((prev) => [created, ...prev]);
      hydrateDraft(created);
      setActiveTab('personal');
      addToast({
        type: 'success',
        title: isId ? 'Berhasil' : 'Success',
        message: isId ? 'Draft CV baru dibuat.' : 'New CV draft created.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal membuat draft CV.' : 'Failed to create CV draft.'),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDraft = async (draft = currentDraft) => {
    if (!draft) return;

    const confirmed = window.confirm(
      isId ? 'Hapus draft CV ini?' : 'Delete this CV draft?'
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await resumesApi.remove(draft.id);
      const nextDrafts = drafts.filter((item) => item.id !== draft.id);
      setDrafts(nextDrafts);

      if (draft.id === selectedDraftId) {
        setSelectedDraftId(null);
        setDraftForm(null);
        setSavedSnapshot('');
        setActiveTab('personal');
      }

      addToast({
        type: 'success',
        title: isId ? 'Terhapus' : 'Deleted',
        message: isId ? 'Draft CV dihapus.' : 'CV draft deleted.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menghapus draft CV.' : 'Failed to delete CV draft.'),
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!draftForm || !previewRef.current) return;
    setDownloading(true);

    try {
      const readyDraft = (await ensureDraftSaved()) || draftForm;
      const pdfBlob = await generatePdfFromElement(previewRef.current);
      const fileName = sanitizeFileName(readyDraft.personal_info.full_name || readyDraft.title);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err?.message || (isId ? 'Gagal menyiapkan PDF CV.' : 'Failed to prepare the CV PDF.'),
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePublishAccountCv = async () => {
    if (!draftForm || !previewRef.current) return;
    setPublishing(true);

    try {
      const readyDraft = (await ensureDraftSaved()) || draftForm;
      const pdfBlob = await generatePdfFromElement(previewRef.current);
      const fileName = `${sanitizeFileName(readyDraft.personal_info.full_name || readyDraft.title)}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      await usersApi.uploadCV(pdfFile);
      await refreshUser();
      addToast({
        type: 'success',
        title: isId ? 'CV aktif diperbarui' : 'Active CV updated',
        message: isId ? 'Draft ini berhasil diunggah sebagai CV akun Anda.' : 'This draft has been uploaded as your account CV.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal memperbarui CV akun.' : 'Failed to update account CV.'),
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: isId ? 'Ukuran gambar maksimal 2MB.' : 'Maximum image size is 2MB.',
      });
      event.target.value = '';
      return;
    }

    setAvatarCropFile(file);
  };

  const cancelAvatarCrop = () => {
    setAvatarCropFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const uploadCroppedAvatar = async (file) => {
    setUploadingAvatar(true);
    try {
      await usersApi.uploadAvatar(file);
      await refreshUser();
      setAvatarCropFile(null);
      setPersonalField('show_photo', true);
      addToast({
        type: 'success',
        title: isId ? 'Berhasil' : 'Success',
        message: isId ? 'Foto profil berhasil diperbarui untuk CV.' : 'Profile photo updated for the CV.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal mengunggah foto profil.' : 'Failed to upload profile photo.'),
      });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const setPersonalField = (field, value) => {
    updateDraftForm((prev) => ({
      ...prev,
      personal_info: {
        ...prev.personal_info,
        [field]: value,
      },
    }));
  };

  const setProfessionalField = (field, value) => {
    updateDraftForm((prev) => ({
      ...prev,
      professional_info: {
        ...prev.professional_info,
        [field]: value,
      },
    }));
  };

  const setEducationInfo = (nextValue) => {
    updateDraftForm((prev) => ({ ...prev, education_info: nextValue }));
  };

  const setOrganisationalInfo = (nextValue) => {
    updateDraftForm((prev) => ({ ...prev, organisational_info: nextValue }));
  };

  const setOtherInfo = (nextValue) => {
    updateDraftForm((prev) => ({ ...prev, other_info: nextValue }));
  };

  const toggleExperienceCard = (index) => {
    setExpandedExperiences((prev) => ({
      ...prev,
      [index]: !(prev[index] ?? true),
    }));
  };

  const scaledPreviewWidth = A4_WIDTH * previewScale;
  const scaledPreviewHeight = A4_HEIGHT * previewScale;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A8A]" />
      </div>
    );
  }

  if (!currentDraft || !draftForm) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <DraftPill tone="accent">{isId ? 'CV Maker' : 'CV Maker'}</DraftPill>
            <div className="space-y-2">
              <h1 className="max-w-[14ch] text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                {isId ? 'Kelola draft CV Anda dengan alur yang lebih rapi.' : 'Manage your CV drafts in a cleaner editor workflow.'}
              </h1>
              <p className="max-w-[64ch] text-base leading-7 text-[#0A1D3D]/50">
                {isId
                  ? 'Buat hingga dua draft CV, buka masing-masing draft dalam editor penuh, unduh PDF saat diperlukan, lalu putuskan sendiri kapan salah satunya menjadi CV akun aktif.'
                  : 'Keep up to two CV drafts, open each in a focused editor, export PDFs on demand, and choose exactly when a draft becomes your active account CV.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-[#E6ECF5] bg-white px-4 py-3 text-sm text-[#0A1D3D]/50 shadow-sm">
              {drafts.length}/2 {isId ? 'draft tersimpan' : 'drafts saved'}
            </div>
            <Button
              onClick={handleCreateDraft}
              disabled={creating || drafts.length >= 2}
              className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold hover:bg-[#0A1D3D]"
            >
              <FilePlus2 size={16} className="mr-2" />
              {creating ? (isId ? 'Membuat...' : 'Creating...') : (isId ? 'Buat Draft Baru' : 'Create Draft')}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-6">
            {drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E6ECF5] bg-white px-8 py-14 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#E6ECF5] text-[#1E3A8A]">
                  <Sparkles size={24} />
                </div>
                <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
                  {isId ? 'Belum ada draft CV.' : 'No CV drafts yet.'}
                </h2>
                <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-7 text-[#0A1D3D]/50">
                  {isId
                    ? 'Mulai dengan membuat draft pertama. Setelah itu Anda akan masuk ke editor khusus dengan preview langsung seperti workspace CV.'
                    : 'Start by creating your first draft. You will then move into a dedicated CV workspace with live preview.'}
                </p>
                <Button
                  onClick={handleCreateDraft}
                  disabled={creating}
                  className="mt-8 rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold hover:bg-[#0A1D3D]"
                >
                  <FilePlus2 size={16} className="mr-2" />
                  {creating ? (isId ? 'Membuat...' : 'Creating...') : (isId ? 'Buat Draft Pertama' : 'Create First Draft')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {drafts.map((draft) => (
                  <DraftLibraryCard
                    key={draft.id}
                    draft={draft}
                    isId={isId}
                    onOpen={handleOpenDraft}
                    onDelete={handleDeleteDraft}
                  />
                ))}
              </div>
            )}
          </div>

          <Card className="rounded-xl border-[#E6ECF5] shadow-sm">
            <CardBody className="space-y-6 p-7">
              <div className="space-y-3">
                <DraftPill>{isId ? 'Cara kerja' : 'Workflow'}</DraftPill>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {isId ? 'Draft library + editor fokus.' : 'Draft library + focused editor.'}
                </h2>
                <p className="text-sm leading-7 text-[#0A1D3D]/50">
                  {isId
                    ? 'Halaman ini sekarang dipisah menjadi dua langkah: pilih draft di library, lalu edit di workspace yang terpisah dengan tabs dan live preview.'
                    : 'This page is now split into two steps: choose a draft from the library, then edit it in a dedicated workspace with tabs and live preview.'}
                </p>
              </div>

              <div className="space-y-4 rounded-xl bg-[#E6ECF5] p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0A1D3D]/80 shadow-sm">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0A1D3D]">{isId ? '1. Buat atau pilih draft' : '1. Create or open a draft'}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#0A1D3D]/50">
                      {isId ? 'Setiap pengguna menyimpan maksimal dua draft aktif.' : 'Each user can keep up to two active drafts.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0A1D3D]/80 shadow-sm">
                    <PencilLine size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0A1D3D]">{isId ? '2. Edit di workspace khusus' : '2. Edit in a dedicated workspace'}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#0A1D3D]/50">
                      {isId ? 'Editor meniru tampilan CV maker modern dengan tab form di kiri dan preview di kanan.' : 'The editor mirrors a modern CV maker with form tabs on the left and preview on the right.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0A1D3D]/80 shadow-sm">
                    <FileDown size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0A1D3D]">{isId ? '3. Unduh atau jadikan CV akun' : '3. Download or promote to account CV'}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#0A1D3D]/50">
                      {isId ? 'PDF tetap generated on demand, tidak disimpan permanen sebagai file baru.' : 'PDFs stay on-demand only and are not permanently stored as extra files.'}
                    </p>
                  </div>
                </div>
              </div>

              {user?.has_cv ? (
                <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] px-4 py-4 text-sm text-[#0A1D3D]/60">
                  {isId ? 'CV akun aktif Anda tetap aman. Draft builder tidak akan menggantinya kecuali Anda memilih "Update CV Akun".' : 'Your active account CV remains untouched unless you explicitly choose "Update Account CV".'}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E6ECF5] bg-white px-4 py-4 text-sm text-[#0A1D3D]/60">
                  {isId ? 'Belum ada CV akun aktif. Anda tetap bisa menyiapkan draft dan mengunggahnya nanti.' : 'You do not have an active account CV yet. You can still prepare drafts and upload one later.'}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleBackToLibrary}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#0A1D3D]/50 transition-colors hover:text-[#0A1D3D]"
        >
          <ArrowLeft size={16} />
          {isId ? 'Kembali ke CV Builder' : 'Back to CV Builder'}
        </button>

        <div className="flex items-center gap-2 text-sm text-[#0A1D3D]/50">
          <Check size={16} className={isDirty ? 'text-[#0A1D3D]/30' : 'text-[#1E3A8A]'} />
          {isDirty
            ? (isId ? 'Ada perubahan yang belum disimpan' : 'You have unsaved changes')
            : (isId ? 'Semua perubahan disimpan' : 'All changes saved')}
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={draftForm.title}
              onChange={(event) => updateDraftForm((prev) => ({ ...prev, title: event.target.value }))}
              className="min-w-[220px] bg-transparent text-[1.9rem] font-semibold tracking-tight text-slate-950 outline-none placeholder:text-[#0A1D3D]/30 md:text-[2.2rem]"
              placeholder={isId ? 'Nama draft CV' : 'CV draft title'}
            />
            <PencilLine size={18} className="text-[#0A1D3D]/30" />
          </div>
          <p className="text-sm text-[#0A1D3D]/50">
            {isId ? 'Terakhir disimpan' : 'Last saved'} {formatTimestamp(draftForm.updated_at, locale)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 font-semibold hover:bg-[#0A1D3D]"
          >
            <FileDown size={16} className="mr-2" />
            {downloading ? (isId ? 'Menyiapkan PDF...' : 'Preparing PDF...') : (isId ? 'Unduh PDF' : 'Download PDF')}
          </Button>

          <div ref={actionsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E6ECF5] bg-white px-4 py-2.5 text-sm font-semibold text-[#0A1D3D]/80 shadow-sm transition-colors hover:border-[#E6ECF5] hover:bg-[#E6ECF5]"
            >
              {isId ? 'Aksi Draft' : 'Draft Actions'}
              <ChevronDown size={16} className={`transition-transform ${actionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {actionsOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border border-[#E6ECF5] bg-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.32)]">
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    saveCurrentDraft();
                  }}
                  disabled={saving || !isDirty}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#0A1D3D]/80 transition-colors hover:bg-[#E6ECF5] disabled:cursor-not-allowed disabled:text-[#0A1D3D]/30"
                >
                  <Save size={16} className="text-[#1E3A8A]" />
                  <span>{saving ? (isId ? 'Menyimpan...' : 'Saving...') : (isId ? 'Simpan Draft' : 'Save Draft')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    handlePublishAccountCv();
                  }}
                  disabled={publishing}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-[#0A1D3D]/80 transition-colors hover:bg-[#E6ECF5] disabled:cursor-not-allowed disabled:text-[#0A1D3D]/30"
                >
                  <FileUp size={16} className="text-[#0A1D3D]/50" />
                  <span>{publishing ? (isId ? 'Memperbarui...' : 'Updating...') : (isId ? 'Update CV Akun' : 'Update Account CV')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    handleDeleteDraft();
                  }}
                  disabled={deleting}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  <Trash2 size={16} />
                  <span>{deleting ? (isId ? 'Menghapus...' : 'Deleting...') : (isId ? 'Hapus Draft' : 'Delete Draft')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-[#E6ECF5]">
        <div className="flex min-w-max items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-1 pb-4 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-[#1E3A8A] text-[#1E3A8A]'
                  : 'border-transparent text-[#0A1D3D]/50 hover:text-[#0A1D3D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.88fr)]">
        <div className="space-y-6">
          {activeTab === 'personal' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Informasi Pribadi' : 'Personal Information'}
                  description={isId ? 'Lengkapi informasi dasar untuk CV Anda.' : 'Complete the foundational identity and profile details for this CV.'}
                />

                <FieldGroup>
                  <Input label={isId ? 'Nama Lengkap' : 'Full Name'} value={draftForm.personal_info.full_name} onChange={(event) => setPersonalField('full_name', event.target.value)} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                  <Input label="Headline" value={draftForm.personal_info.headline} onChange={(event) => setPersonalField('headline', event.target.value)} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                </FieldGroup>

                <FieldGroup columns="two">
                  <Input label="Email" value={draftForm.personal_info.email} onChange={(event) => setPersonalField('email', event.target.value)} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                  <Input label={isId ? 'No. Telepon' : 'Phone'} value={draftForm.personal_info.phone} onChange={(event) => setPersonalField('phone', event.target.value)} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                </FieldGroup>

                <FieldGroup columns="two">
                  <Input label={isId ? 'Lokasi' : 'Location'} value={draftForm.personal_info.location} onChange={(event) => setPersonalField('location', event.target.value)} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                  <Input
                    label="LinkedIn"
                    value={draftForm.personal_info.links[0]?.url || ''}
                    onChange={(event) => {
                      const nextLinks = draftForm.personal_info.links.length
                        ? updateAtIndex(draftForm.personal_info.links, 0, { ...draftForm.personal_info.links[0], label: draftForm.personal_info.links[0].label || 'LinkedIn', url: event.target.value })
                        : [{ label: 'LinkedIn', url: event.target.value }];
                      setPersonalField('links', nextLinks);
                    }}
                    className="rounded-xl border border-[#E6ECF5] px-4 py-2.5"
                  />
                </FieldGroup>

                <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 overflow-hidden rounded-xl border border-[#E6ECF5] bg-white">
                        {user?.avatar ? (
                          <img src={resolveUploadUrl(user.avatar)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#0A1D3D]/40">
                            {isId ? 'Tanpa foto' : 'No photo'}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#0A1D3D]">{isId ? 'Foto Profil di CV' : 'Profile Photo in CV'}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#0A1D3D]/50">
                          {isId ? 'Gunakan foto profil akun saat ini, atau unggah foto profil baru untuk dipakai juga di CV.' : 'Use your current account profile photo, or upload a new profile photo that will also be used in the CV.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-[#E6ECF5] bg-white px-3 py-2 text-sm text-[#0A1D3D]/80">
                        <input
                          type="checkbox"
                          checked={draftForm.personal_info.show_photo}
                          onChange={(event) => setPersonalField('show_photo', event.target.checked)}
                        />
                        {isId ? 'Gunakan foto profil saat ini' : 'Use current profile photo'}
                      </label>

                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarSelect}
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#E6ECF5] bg-white px-3 py-2 text-sm font-medium text-[#0A1D3D]/80 transition-colors hover:border-[#E6ECF5] hover:bg-[#E6ECF5] disabled:opacity-60"
                      >
                        <ImageUp size={16} />
                        {uploadingAvatar ? (isId ? 'Mengunggah...' : 'Uploading...') : (isId ? 'Unggah Foto Baru' : 'Upload New Photo')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E6ECF5] pt-7">
                  <TextareaField
                    label={isId ? 'Ringkasan' : 'Summary'}
                    helper={isId ? 'Ceritakan tentang diri Anda secara singkat.' : 'Describe yourself in a concise professional summary.'}
                    value={draftForm.professional_info.summary}
                    onChange={(event) => setProfessionalField('summary', event.target.value)}
                  />
                </div>
              </div>
            </EditorPanel>
          )}

          {activeTab === 'experience' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Pengalaman' : 'Experience'}
                  description={isId ? 'Susun pengalaman profesional dan organisasi yang paling relevan.' : 'Curate the most relevant professional and organizational experience.'}
                />

                <div className="space-y-4">
                  {draftForm.professional_info.experiences.map((item, index) => (
                    <EntryCard
                      key={`experience-editor-${index}`}
                      title={item.role || `${isId ? 'Pengalaman' : 'Experience'} ${index + 1}`}
                      subtitle={item.organization || (isId ? 'Isi detail posisi dan dampaknya.' : 'Fill in the role details and impact.')}
                      onRemove={() => setProfessionalField('experiences', removeAtIndex(draftForm.professional_info.experiences, index))}
                      collapsible
                      expanded={expandedExperiences[index] ?? true}
                      onToggle={() => toggleExperienceCard(index)}
                    >
                      <FieldGroup columns="two">
                        <Input label={isId ? 'Role' : 'Role'} value={item.role} onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, { ...item, role: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Organisasi / Perusahaan' : 'Organization / Company'} value={item.organization} onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, { ...item, organization: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <FieldGroup columns="three">
                        <Input label={isId ? 'Lokasi' : 'Location'} value={item.location} onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, { ...item, location: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input type="month" label={isId ? 'Mulai' : 'Start'} value={item.start_date} onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, { ...item, start_date: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input type="month" label={isId ? 'Selesai' : 'End'} value={item.end_date} onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, { ...item, end_date: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <TextareaField
                        label={isId ? 'Deskripsi Organisasi / Perusahaan' : 'Organization / Company Description'}
                        helper={isId ? 'Jelaskan konteks organisasi atau perusahaan ini secara singkat.' : 'Describe the company or organization context in a concise way.'}
                        value={item.organization_description}
                        onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, { ...item, organization_description: event.target.value }))}
                      />

                      <TextareaField
                        label={isId ? 'Work Portfolio & Achievements' : 'Work Portfolio & Achievements'}
                        helper={isId ? 'Tulis satu poin per baris. Bullet akan tetap terlihat di dalam form.' : 'Write one point per line. Bullet markers stay visible in the form.'}
                        value={buildBulletTextareaValue(item.achievements || [])}
                        onChange={(event) => setProfessionalField('experiences', updateAtIndex(draftForm.professional_info.experiences, index, {
                          ...item,
                          achievements: parseBulletTextareaValue(event.target.value),
                        }))}
                      />
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Pengalaman' : 'Add Experience'}
                    onClick={() => setProfessionalField('experiences', [
                      ...draftForm.professional_info.experiences,
                      { role: '', organization: '', location: '', start_date: '', end_date: '', organization_description: '', achievements: [] },
                    ])}
                  />
                </div>

                <div className="space-y-4 border-t border-[#E6ECF5] pt-7">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-[#0A1D3D]">{isId ? 'Pengalaman Organisasi' : 'Organizational Experience'}</h3>
                    <p className="text-sm text-[#0A1D3D]/50">
                      {isId ? 'Gunakan bagian ini untuk himpunan, kepanitiaan, atau komunitas.' : 'Use this for student bodies, committees, and communities.'}
                    </p>
                  </div>

                  {draftForm.organisational_info.organizations.map((item, index) => (
                    <EntryCard
                      key={`organization-editor-${index}`}
                      title={item.name || `${isId ? 'Organisasi' : 'Organization'} ${index + 1}`}
                      subtitle={item.role || (isId ? 'Tambahkan peran dan kontribusi.' : 'Add role and contributions.')}
                      onRemove={() => setOrganisationalInfo({ organizations: removeAtIndex(draftForm.organisational_info.organizations, index) })}
                    >
                      <FieldGroup columns="two">
                        <Input label={isId ? 'Nama Organisasi' : 'Organization Name'} value={item.name} onChange={(event) => setOrganisationalInfo({ organizations: updateAtIndex(draftForm.organisational_info.organizations, index, { ...item, name: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Peran' : 'Role'} value={item.role} onChange={(event) => setOrganisationalInfo({ organizations: updateAtIndex(draftForm.organisational_info.organizations, index, { ...item, role: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <FieldGroup columns="two">
                        <Input type="month" label={isId ? 'Mulai' : 'Start'} value={item.start_date} onChange={(event) => setOrganisationalInfo({ organizations: updateAtIndex(draftForm.organisational_info.organizations, index, { ...item, start_date: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input type="month" label={isId ? 'Selesai' : 'End'} value={item.end_date} onChange={(event) => setOrganisationalInfo({ organizations: updateAtIndex(draftForm.organisational_info.organizations, index, { ...item, end_date: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <TextareaField
                        label={isId ? 'Kontribusi' : 'Contribution'}
                        value={item.description}
                        onChange={(event) => setOrganisationalInfo({ organizations: updateAtIndex(draftForm.organisational_info.organizations, index, { ...item, description: event.target.value }) })}
                      />
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Organisasi' : 'Add Organization'}
                    onClick={() => setOrganisationalInfo({
                      organizations: [
                        ...draftForm.organisational_info.organizations,
                        { name: '', role: '', start_date: '', end_date: '', description: '' },
                      ],
                    })}
                  />
                </div>
              </div>
            </EditorPanel>
          )}

          {activeTab === 'education' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Pendidikan' : 'Education'}
                  description={isId ? 'Masukkan pendidikan formal yang relevan untuk CV ini.' : 'Add the formal education history most relevant to this CV.'}
                />

                <div className="space-y-4">
                  {draftForm.education_info.educations.map((item, index) => (
                    <EntryCard
                      key={`education-editor-${index}`}
                      title={item.institution || `${isId ? 'Pendidikan' : 'Education'} ${index + 1}`}
                      subtitle={item.major || (isId ? 'Lengkapi institusi, gelar, dan konteks akademik.' : 'Fill in institution, degree, and academic context.')}
                      onRemove={() => setEducationInfo({ educations: removeAtIndex(draftForm.education_info.educations, index) })}
                    >
                      <FieldGroup columns="two">
                        <Input label={isId ? 'Institusi' : 'Institution'} value={item.institution} onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, institution: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Gelar' : 'Degree'} value={item.degree} onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, degree: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <FieldGroup columns="four">
                        <Select label={isId ? 'Jurusan' : 'Major'} value={item.major} onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, major: event.target.value }) })} options={buildMajorOptions([item.major])} placeholder={isId ? 'Pilih jurusan IPB' : 'Choose an IPB major'} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input type="month" label={isId ? 'Mulai' : 'Start'} value={item.start_date} onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, start_date: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input type="month" label={isId ? 'Selesai' : 'End'} value={item.end_date} onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, end_date: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label="GPA" value={item.gpa} onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, gpa: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <TextareaField
                        label={isId ? 'Catatan Akademik' : 'Academic Notes'}
                        helper={isId ? 'Misalnya coursework, prestasi, atau fokus riset.' : 'For coursework, achievements, or research focus.'}
                        value={item.description}
                        onChange={(event) => setEducationInfo({ educations: updateAtIndex(draftForm.education_info.educations, index, { ...item, description: event.target.value }) })}
                      />
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Pendidikan' : 'Add Education'}
                    onClick={() => setEducationInfo({
                      educations: [
                        ...draftForm.education_info.educations,
                        { institution: '', degree: '', major: '', start_date: '', end_date: '', gpa: '', description: '' },
                      ],
                    })}
                  />
                </div>
              </div>
            </EditorPanel>
          )}

          {activeTab === 'skills' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Keterampilan' : 'Skills'}
                  description={isId ? 'Fokuskan keterampilan utama yang relevan untuk posisi yang Anda incar.' : 'Highlight the core skills relevant to the role you are targeting.'}
                />

                <TextareaField
                  label={isId ? 'Keterampilan Inti' : 'Core Skills'}
                  helper={isId ? 'Pisahkan dengan koma, misalnya: SQL, Python, Public Speaking.' : 'Separate items with commas, for example: SQL, Python, Public Speaking.'}
                  value={draftForm.professional_info.skills.join(', ')}
                  onChange={(event) => setProfessionalField('skills', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                  className="min-h-[150px]"
                />

                <div className="space-y-4 border-t border-[#E6ECF5] pt-7">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-[#0A1D3D]">{isId ? 'Bahasa' : 'Languages'}</h3>
                    <p className="text-sm text-[#0A1D3D]/50">
                      {isId ? 'Tambahkan bahasa beserta tingkat penguasaan.' : 'Add language proficiency for international or client-facing roles.'}
                    </p>
                  </div>

                  {draftForm.other_info.languages.map((item, index) => (
                    <EntryCard
                      key={`language-editor-${index}`}
                      title={item.name || `${isId ? 'Bahasa' : 'Language'} ${index + 1}`}
                      onRemove={() => setOtherInfo({ ...draftForm.other_info, languages: removeAtIndex(draftForm.other_info.languages, index) })}
                    >
                      <FieldGroup columns="two">
                        <Input label={isId ? 'Bahasa' : 'Language'} value={item.name} onChange={(event) => setOtherInfo({ ...draftForm.other_info, languages: updateAtIndex(draftForm.other_info.languages, index, { ...item, name: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Tingkat' : 'Proficiency'} value={item.proficiency} onChange={(event) => setOtherInfo({ ...draftForm.other_info, languages: updateAtIndex(draftForm.other_info.languages, index, { ...item, proficiency: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Bahasa' : 'Add Language'}
                    onClick={() => setOtherInfo({
                      ...draftForm.other_info,
                      languages: [...draftForm.other_info.languages, { name: '', proficiency: '' }],
                    })}
                  />
                </div>
              </div>
            </EditorPanel>
          )}

          {activeTab === 'projects' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Proyek' : 'Projects'}
                  description={isId ? 'Tambahkan proyek yang menunjukkan kemampuan teknis, kepemimpinan, atau dampak nyata.' : 'Showcase projects that demonstrate technical skill, leadership, or measurable impact.'}
                />

                <div className="space-y-4">
                  {draftForm.professional_info.projects.map((item, index) => (
                    <EntryCard
                      key={`project-editor-${index}`}
                      title={item.name || `${isId ? 'Proyek' : 'Project'} ${index + 1}`}
                      subtitle={item.role || (isId ? 'Lengkapi nama proyek, peran, dan deskripsi.' : 'Fill in project title, role, and impact.')}
                      onRemove={() => setProfessionalField('projects', removeAtIndex(draftForm.professional_info.projects, index))}
                    >
                      <FieldGroup columns="two">
                        <Input label={isId ? 'Nama Proyek' : 'Project Name'} value={item.name} onChange={(event) => setProfessionalField('projects', updateAtIndex(draftForm.professional_info.projects, index, { ...item, name: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Peran' : 'Role'} value={item.role} onChange={(event) => setProfessionalField('projects', updateAtIndex(draftForm.professional_info.projects, index, { ...item, role: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <Input label="Link" value={item.link} onChange={(event) => setProfessionalField('projects', updateAtIndex(draftForm.professional_info.projects, index, { ...item, link: event.target.value }))} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />

                      <TextareaField
                        label={isId ? 'Deskripsi Proyek' : 'Project Description'}
                        value={item.description}
                        onChange={(event) => setProfessionalField('projects', updateAtIndex(draftForm.professional_info.projects, index, { ...item, description: event.target.value }))}
                      />
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Proyek' : 'Add Project'}
                    onClick={() => setProfessionalField('projects', [
                      ...draftForm.professional_info.projects,
                      { name: '', role: '', link: '', description: '' },
                    ])}
                  />
                </div>
              </div>
            </EditorPanel>
          )}

          {activeTab === 'certifications' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Sertifikat & Tambahan' : 'Certificates & Extras'}
                  description={isId ? 'Gabungkan sertifikat, penghargaan, dan minat pendukung di sini.' : 'Keep certificates, awards, and supporting interests in one place.'}
                />

                <div className="space-y-4">
                  {draftForm.other_info.certifications.map((item, index) => (
                    <EntryCard
                      key={`certification-editor-${index}`}
                      title={item.name || `${isId ? 'Sertifikat' : 'Certificate'} ${index + 1}`}
                      subtitle={item.issuer || (isId ? 'Masukkan lembaga penerbit dan tahun.' : 'Add issuer and year details.')}
                      onRemove={() => setOtherInfo({ ...draftForm.other_info, certifications: removeAtIndex(draftForm.other_info.certifications, index) })}
                    >
                      <FieldGroup columns="two">
                        <Input label={isId ? 'Nama Sertifikat' : 'Certificate Name'} value={item.name} onChange={(event) => setOtherInfo({ ...draftForm.other_info, certifications: updateAtIndex(draftForm.other_info.certifications, index, { ...item, name: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Penerbit' : 'Issuer'} value={item.issuer} onChange={(event) => setOtherInfo({ ...draftForm.other_info, certifications: updateAtIndex(draftForm.other_info.certifications, index, { ...item, issuer: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <FieldGroup columns="two">
                        <Input label={isId ? 'Tahun' : 'Year'} value={item.year} onChange={(event) => setOtherInfo({ ...draftForm.other_info, certifications: updateAtIndex(draftForm.other_info.certifications, index, { ...item, year: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label="Link" value={item.link} onChange={(event) => setOtherInfo({ ...draftForm.other_info, certifications: updateAtIndex(draftForm.other_info.certifications, index, { ...item, link: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Sertifikat' : 'Add Certificate'}
                    onClick={() => setOtherInfo({
                      ...draftForm.other_info,
                      certifications: [...draftForm.other_info.certifications, { name: '', issuer: '', year: '', link: '' }],
                    })}
                  />
                </div>

                <div className="space-y-4 border-t border-[#E6ECF5] pt-7">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-[#0A1D3D]">{isId ? 'Penghargaan' : 'Awards'}</h3>
                    <p className="text-sm text-[#0A1D3D]/50">
                      {isId ? 'Opsional, tapi berguna untuk membedakan pencapaian Anda.' : 'Optional, but useful to differentiate your achievements.'}
                    </p>
                  </div>

                  {draftForm.other_info.awards.map((item, index) => (
                    <EntryCard
                      key={`award-editor-${index}`}
                      title={item.name || `${isId ? 'Penghargaan' : 'Award'} ${index + 1}`}
                      onRemove={() => setOtherInfo({ ...draftForm.other_info, awards: removeAtIndex(draftForm.other_info.awards, index) })}
                    >
                      <FieldGroup columns="three">
                        <Input label={isId ? 'Nama' : 'Name'} value={item.name} onChange={(event) => setOtherInfo({ ...draftForm.other_info, awards: updateAtIndex(draftForm.other_info.awards, index, { ...item, name: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Pemberi' : 'Issuer'} value={item.issuer} onChange={(event) => setOtherInfo({ ...draftForm.other_info, awards: updateAtIndex(draftForm.other_info.awards, index, { ...item, issuer: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                        <Input label={isId ? 'Tahun' : 'Year'} value={item.year} onChange={(event) => setOtherInfo({ ...draftForm.other_info, awards: updateAtIndex(draftForm.other_info.awards, index, { ...item, year: event.target.value }) })} className="rounded-xl border border-[#E6ECF5] px-4 py-2.5" />
                      </FieldGroup>

                      <TextareaField
                        label={isId ? 'Deskripsi' : 'Description'}
                        value={item.description}
                        onChange={(event) => setOtherInfo({ ...draftForm.other_info, awards: updateAtIndex(draftForm.other_info.awards, index, { ...item, description: event.target.value }) })}
                      />
                    </EntryCard>
                  ))}

                  <AddRowButton
                    label={isId ? 'Tambah Penghargaan' : 'Add Award'}
                    onClick={() => setOtherInfo({
                      ...draftForm.other_info,
                      awards: [...draftForm.other_info.awards, { name: '', issuer: '', year: '', description: '' }],
                    })}
                  />
                </div>

                <div className="border-t border-[#E6ECF5] pt-7">
                  <TextareaField
                    label={isId ? 'Minat / Topik Lainnya' : 'Interests / Other Topics'}
                    helper={isId ? 'Pisahkan dengan koma untuk menampilkan daftar singkat di CV.' : 'Separate items with commas for a concise list in the CV.'}
                    value={draftForm.other_info.interests.join(', ')}
                    onChange={(event) => setOtherInfo({
                      ...draftForm.other_info,
                      interests: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    })}
                    className="min-h-[120px]"
                  />
                </div>
              </div>
            </EditorPanel>
          )}

          {activeTab === 'preview' && (
            <EditorPanel>
              <div className="space-y-7">
                <SectionIntro
                  title={isId ? 'Final Review' : 'Final Review'}
                  description={isId ? 'Periksa kualitas isi, lalu tentukan tindakan akhir untuk draft klasik ini.' : 'Review content quality, then choose the final action for this classic draft.'}
                />

                <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0A1D3D]">
                    <Eye size={16} />
                    {isId ? 'Checklist Isi' : 'Content Checklist'}
                  </div>
                  {warnings.length === 0 ? (
                    <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] px-4 py-4 text-sm text-[#1E3A8A]">
                      {isId ? 'Draft ini sudah cukup lengkap untuk diekspor atau diunggah sebagai CV akun.' : 'This draft is complete enough to export or upload as the account CV.'}
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-[#0A1D3D]/60">
                      {warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    className="rounded-xl border border-[#E6ECF5] bg-white p-5 text-left shadow-sm transition-colors hover:border-[#E6ECF5]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6ECF5] text-[#0A1D3D]/80">
                        <FileDown size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#0A1D3D]">{isId ? 'Unduh PDF' : 'Download PDF'}</h3>
                        <p className="mt-1 text-sm text-[#0A1D3D]/50">
                          {isId ? 'Generate file PDF saat dibutuhkan, tanpa menyimpan file permanen baru.' : 'Generate the PDF on demand without storing a permanent extra file.'}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handlePublishAccountCv}
                    disabled={publishing}
                    className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] p-5 text-left shadow-sm transition-colors hover:border-[#bddfc8]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#1E3A8A]">
                        <FileUp size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#0A1D3D]">
                          {publishing ? (isId ? 'Memperbarui CV akun...' : 'Updating account CV...') : (isId ? 'Update CV Akun' : 'Update Account CV')}
                        </h3>
                        <p className="mt-1 text-sm text-[#0A1D3D]/50">
                          {isId ? 'Gunakan draft ini sebagai PDF aktif di akun Anda, tetapi hanya jika Anda benar-benar memilihnya.' : 'Use this draft as the active PDF on your account, but only when you explicitly choose it.'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="rounded-xl border border-[#E6ECF5] bg-white px-4 py-4 text-sm text-[#0A1D3D]/60">
                  {user?.has_cv
                    ? (isId ? `CV aktif Anda saat ini tetap aman sampai Anda menekan "Update CV Akun".` : 'Your current active CV remains unchanged until you press "Update Account CV".')
                    : (isId ? 'Anda belum memiliki CV akun aktif, jadi langkah berikutnya biasanya unduh PDF atau update CV akun saat siap.' : 'You do not have an active account CV yet, so the next step is usually to download the PDF or update the account CV when ready.')}
                </div>
              </div>
            </EditorPanel>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-xl border border-[#E6ECF5] bg-[#f8faf8] shadow-sm">
            <div className="max-h-[70vh] overflow-y-auto p-3 md:max-h-[calc(100dvh-9rem)] md:p-4">
              <div ref={previewViewportRef} className="w-full">
                <div className="mx-auto flex flex-col gap-4" style={{ width: `${scaledPreviewWidth}px` }}>
                  {Array.from({ length: previewPageCount }).map((_, index) => (
                    <div
                      key={index}
                      className="relative overflow-hidden border border-[#E6ECF5] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.32)]"
                      style={{
                        width: `${scaledPreviewWidth}px`,
                        height: `${scaledPreviewHeight}px`,
                      }}
                    >
                      {previewPageCount > 1 && (
                        <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-white/92 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0A1D3D]/40 shadow-sm">
                          {isId ? `Halaman ${index + 1}` : `Page ${index + 1}`}
                        </span>
                      )}

                      <div
                        className="absolute left-0 top-0 origin-top-left"
                        style={{
                          width: `${A4_WIDTH}px`,
                          transform: `scale(${previewScale})`,
                        }}
                      >
                        <div style={{ transform: `translateY(-${index * A4_HEIGHT}px)` }}>
                          <CVPreview draft={draftForm} user={user} locale={locale} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-100000px] top-0 opacity-0"
      >
        <div ref={previewRef}>
          <CVPreview draft={draftForm} user={user} locale={locale} />
        </div>
      </div>

      <AvatarCropModal
        file={avatarCropFile}
        isOpen={Boolean(avatarCropFile)}
        onCancel={cancelAvatarCrop}
        onConfirm={uploadCroppedAvatar}
        isId={isId}
        uploading={uploadingAvatar}
      />
    </div>
  );
}
