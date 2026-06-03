import html
import logging
import re
from typing import Iterable
from urllib.parse import urljoin

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


# ── Brand palette (mirrors fe-web/tailwind.config.js) ─────────────
# Keep in sync with the frontend theme so emails match the product.
BRAND_PRIMARY = "#1a8754"        # brand.DEFAULT
BRAND_DARK = "#146c43"           # brand.dark
BRAND_LIGHT = "#22a96a"          # brand.light
BRAND_MUTED_BG = "#e8f5e9"       # brand.muted
BRAND_HEADER_BG = "#146c43"      # darker for email headers
BRAND_HEADER_ACCENT = "#a7e3c4"  # light-on-dark caption

TEXT_DEFAULT = "#111827"          # text.DEFAULT
TEXT_MUTED = "#6b7280"           # text.muted
TEXT_LIGHT = "#9ca3af"           # text.light
SURFACE_BORDER = "#e5e7eb"       # surface.border
SURFACE_MUTED_BG = "#f9fafb"     # surface.muted
PAGE_BG = "#f5f6f8"              # used by DetailPerusahaan hero

FONT_STACK = (
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', "
    "Roboto, Helvetica, Arial, sans-serif"
)


# Status badge palette (for application status emails).
STATUS_PALETTE: dict[str, tuple[str, str]] = {
    # name -> (background, text)
    "accepted": ("#dcfce7", "#166534"),       # green
    "reviewing": ("#dbeafe", "#1e40af"),      # blue
    "rejected": ("#fee2e2", "#991b1b"),        # red
    "shortlisted": ("#fef3c7", "#92400e"),    # amber
    "interview": ("#ede9fe", "#5b21b6"),      # purple
    "info": ("#e0f2fe", "#075985"),           # sky
    "success": ("#dcfce7", "#166534"),
    "warning": ("#fef3c7", "#92400e"),
    "error": ("#fee2e2", "#991b1b"),
}


class EmailService:
    """Thin Resend wrapper for transactional notification emails."""

    def __init__(self):
        self._settings = get_settings()

    # ── Configuration ──────────────────────────────────────────

    @property
    def is_configured(self) -> bool:
        return bool(
            self._settings.EMAIL_ENABLED
            and self._settings.RESEND_API_KEY
            and self._settings.EMAIL_FROM
        )

    # ── Public send methods (typed) ────────────────────────────

    def send_verification_email(
        self,
        to_email: str,
        to_name: str,
        verify_url: str,
        expires_hours: int,
    ) -> bool:
        """Send a signup email verification link."""
        content = self._render_verification_content(
            to_name=to_name,
            verify_url=verify_url,
            expires_hours=expires_hours,
        )
        return self._send(
            to_email,
            "Verify your TUMBUH email",
            subject_lead="Verify your email",
            preview_text="Confirm your email to activate your TUMBUH account.",
            content_html=content,
            text_body=self._text_verification(to_name, verify_url, expires_hours),
            to_name=to_name,
        )

    def send_welcome_email(self, to_email: str, to_name: str) -> bool:
        """Send a welcome email after a successful verification."""
        content = self._render_welcome_content(to_name=to_name)
        return self._send(
            to_email,
            "Welcome to TUMBUH",
            subject_lead=f"Welcome, {to_name.split(' ')[0] if to_name else 'there'}",
            preview_text="Your TUMBUH account is ready. Here's how to get started.",
            content_html=content,
            text_body=self._text_welcome(to_name),
            to_name=to_name,
        )

    def send_invitation_email(
        self,
        to_email: str,
        to_name: str | None,
        *,
        inviter_name: str,
        org_name: str,
        role_label: str,
        accept_url: str,
        expires_days: int,
    ) -> bool:
        """Send an HR-organization invitation to a prospective member."""
        content = self._render_invitation_content(
            inviter_name=inviter_name,
            org_name=org_name,
            role_label=role_label,
            accept_url=accept_url,
            expires_days=expires_days,
        )
        return self._send(
            to_email,
            f"Join {org_name} on TUMBUH",
            subject_lead=f"{inviter_name} invited you to {org_name}",
            preview_text=f"You're invited to join {org_name} as a {role_label}.",
            content_html=content,
            text_body=self._text_invitation(inviter_name, org_name, role_label, accept_url, expires_days),
            to_name=to_name or to_email,
        )

    def send_application_status_email(
        self,
        to_email: str,
        to_name: str,
        *,
        opportunity_title: str,
        company_name: str,
        new_status: str,
        view_url: str,
    ) -> bool:
        """Send a status update notification to a student applicant."""
        normalized = (new_status or "").lower()
        bg, fg = STATUS_PALETTE.get(normalized, STATUS_PALETTE["info"])
        subject_lead = f"Application update: {opportunity_title}"
        preview_text = (
            f"Your application for {opportunity_title} at {company_name} "
            f"is now {normalized}."
        )
        content = self._render_application_status_content(
            to_name=to_name,
            opportunity_title=opportunity_title,
            company_name=company_name,
            status_label=new_status.replace("_", " ").title(),
            status_bg=bg,
            status_fg=fg,
            view_url=view_url,
        )
        return self._send(
            to_email,
            f"Application status updated: {normalized.title()}",
            subject_lead=subject_lead,
            preview_text=preview_text,
            content_html=content,
            text_body=self._text_application_status(
                to_name, opportunity_title, company_name, new_status, view_url
            ),
            to_name=to_name,
        )

    def send_notification_email(
        self,
        to_email: str,
        subject: str,
        message: str,
        *,
        to_name: str | None = None,
        action_label: str | None = None,
        action_url: str | None = None,
        notification_type: str = "info",
    ) -> bool:
        """Send a generic notification email (fallback for ad-hoc updates)."""
        content = self._render_generic_content(
            message=message,
            action_label=action_label,
            action_url=action_url,
            notification_type=notification_type,
        )
        preview = message.strip().splitlines()[0][:140] if message else subject
        return self._send(
            to_email,
            subject,
            subject_lead=subject,
            preview_text=preview,
            content_html=content,
            text_body=self._text_generic(message, action_label, action_url),
            to_name=to_name,
        )

    # ── Raw escape hatch (used by callers that need full control) ─

    def send_email(
        self,
        to_email: str,
        subject: str,
        *,
        html_body: str,
        text_body: str,
        to_name: str | None = None,
    ) -> bool:
        """Send a pre-built HTML email. Prefer the typed methods above."""
        return self._send(
            to_email,
            subject,
            subject_lead=None,        # body already has its own header
            preview_text=None,
            content_html=html_body,
            text_body=text_body,
            to_name=to_name,
            skip_layout=True,
        )

    # ── Internal transport ─────────────────────────────────────

    def _send(
        self,
        to_email: str,
        subject: str,
        *,
        subject_lead: str | None,
        preview_text: str | None,
        content_html: str,
        text_body: str,
        to_name: str | None,
        skip_layout: bool = False,
    ) -> bool:
        if not self.is_configured:
            return False

        try:
            import resend

            resend.api_key = self._settings.RESEND_API_KEY
            full_html = (
                content_html
                if skip_layout
                else self._render_layout(
                    subject_lead=subject_lead or subject,
                    preview_text=preview_text,
                    content_html=content_html,
                )
            )
            params = {
                "from": self._settings.EMAIL_FROM,
                "to": [self._format_recipient(to_email, to_name)],
                "subject": subject,
                "html": full_html,
                "text": text_body,
            }
            if self._settings.EMAIL_REPLY_TO:
                params["reply_to"] = self._settings.EMAIL_REPLY_TO

            resend.Emails.send(params)
            return True
        except Exception:
            logger.exception("Failed to send email to %s", to_email)
            return False

    # ── Layout primitives ──────────────────────────────────────

    def _render_layout(
        self,
        *,
        subject_lead: str,
        preview_text: str | None,
        content_html: str,
    ) -> str:
        safe_lead = html.escape(subject_lead)
        preview_block = (
            f'<span style="display:none;font-size:1px;color:{PAGE_BG};line-height:1px;'
            f'max-height:0;max-width:0;opacity:0;overflow:hidden">'
            f'{html.escape(preview_text)}</span>'
            if preview_text
            else ""
        )
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>{safe_lead}</title>
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};font-family:{FONT_STACK};color:{TEXT_DEFAULT};-webkit-text-size-adjust:100%">
{preview_block}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAGE_BG};width:100%">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid {SURFACE_BORDER}">
        <tr>
          <td style="background:{BRAND_HEADER_BG};padding:24px 32px">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.04em">TUMBUH</p>
            <p style="margin:4px 0 0;font-size:11px;color:{BRAND_HEADER_ACCENT};letter-spacing:0.16em;text-transform:uppercase">IPB Career &amp; Internship Tracker</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            {content_html}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:{SURFACE_MUTED_BG};border-top:1px solid {SURFACE_BORDER}">
            <p style="margin:0;font-size:12px;line-height:1.6;color:{TEXT_MUTED}">
              You're receiving this email because you have an account on TUMBUH.
              <br>
              &copy; 2026 TUMBUH &middot; IPB Career &amp; Internship Tracker
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:{TEXT_LIGHT};max-width:600px">
        Need help? Reply to this email and we'll get back to you.
      </p>
    </td>
  </tr>
</table>
</body>
</html>"""

    def _render_button(
        self,
        label: str,
        url: str,
        *,
        bg: str = BRAND_DARK,
        fg: str = "#ffffff",
    ) -> str:
        return (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">'
            '<tr><td style="background:' + bg + ';border-radius:8px">'
            f'<a href="{html.escape(url)}" target="_blank" rel="noopener" '
            'style="display:inline-block;padding:13px 26px;color:' + fg + ';'
            'text-decoration:none;font-weight:600;font-size:15px;line-height:1.2;'
            'mso-padding-alt:0;letter-spacing:0.01em">'
            f"{html.escape(label)}</a>"
            "</td></tr></table>"
        )

    def _render_status_pill(self, label: str, bg: str, fg: str) -> str:
        return (
            '<p style="margin:0 0 12px;display:inline-block;background:' + bg + ';color:' + fg + ';' 
            'padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;'
            'text-transform:uppercase;letter-spacing:0.08em;line-height:1">'
            f"{html.escape(label)}</p>"
        )

    def _render_muted_note(self, text: str) -> str:
        return (
            f'<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:{TEXT_LIGHT}">'
            f"{text}</p>"
        )

    def _render_link_fallback(self, url: str) -> str:
        return (
            f'<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:{TEXT_MUTED};word-break:break-all">'
            f"Or copy this link into your browser:<br>"
            f'<a href="{html.escape(url)}" style="color:{BRAND_PRIMARY};text-decoration:underline">{html.escape(url)}</a>'
            "</p>"
        )

    # ── Per-template content sections ──────────────────────────

    def _render_verification_content(
        self, *, to_name: str, verify_url: str, expires_hours: int
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        body = (
            f'<h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:{TEXT_DEFAULT};line-height:1.3">'
            f"Verify your email</h1>"
            f'<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:{TEXT_MUTED}">'
            f"Hi {html.escape(first)}, confirm your email address to activate your TUMBUH account.</p>"
        )
        body += self._render_button("Verify email", verify_url)
        body += self._render_muted_note(
            f"This link expires in {int(expires_hours)} hours. "
            "If you didn't create a TUMBUH account, you can safely ignore this email."
        )
        body += self._render_link_fallback(verify_url)
        return body

    def _render_welcome_content(self, *, to_name: str) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        dashboard_url = f"{self._settings.FRONTEND_URL.rstrip('/')}/beranda"
        body = (
            f'<h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:{TEXT_DEFAULT};line-height:1.3">'
            f"Welcome to TUMBUH, {html.escape(first)}!</h1>"
            f'<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:{TEXT_MUTED}">'
            "Your account is verified and ready. TUMBUH helps IPB students discover "
            "internships, externships, and entry-level opportunities — and helps "
            "companies find great IPB talent.</p>"
        )
        body += self._render_button("Open your dashboard", dashboard_url)
        body += self._render_muted_note(
            "Tip: complete your profile and upload your CV to be discoverable by HR partners."
        )
        return body

    def _render_invitation_content(
        self,
        *,
        inviter_name: str,
        org_name: str,
        role_label: str,
        accept_url: str,
        expires_days: int,
    ) -> str:
        body = (
            f'<h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:{TEXT_DEFAULT};line-height:1.3">'
            f"You've been invited</h1>"
            f'<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:{TEXT_MUTED}">'
            f"<strong>{html.escape(inviter_name)}</strong> has invited you to join "
            f"<strong>{html.escape(org_name)}</strong> on TUMBUH as a "
            f"<strong>{html.escape(role_label)}</strong>.</p>"
            f'<p style="margin:0;font-size:14px;line-height:1.6;color:{TEXT_LIGHT}">'
            "TUMBUH helps IPB students and companies connect through internships and "
            "entry-level opportunities. Accept this invite to start managing roles, "
            "opportunities, and applicants with your team.</p>"
        )
        body += self._render_button("Accept invitation", accept_url)
        body += self._render_muted_note(
            f"This invitation expires in {int(expires_days)} days. "
            "If you weren't expecting this email, you can ignore it."
        )
        body += self._render_link_fallback(accept_url)
        return body

    def _render_application_status_content(
        self,
        *,
        to_name: str,
        opportunity_title: str,
        company_name: str,
        status_label: str,
        status_bg: str,
        status_fg: str,
        view_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        body = self._render_status_pill(status_label, status_bg, status_fg)
        body += (
            f'<h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:{TEXT_DEFAULT};line-height:1.3">'
            f"Application update</h1>"
            f'<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:{TEXT_MUTED}">'
            f"Hi {html.escape(first)}, your application for "
            f"<strong>{html.escape(opportunity_title)}</strong> at "
            f"<strong>{html.escape(company_name)}</strong> has been updated.</p>"
        )
        body += self._render_button("View my applications", view_url, bg=BRAND_DARK)
        body += self._render_muted_note(
            "Log in to TUMBUH to see the full conversation and next steps."
        )
        return body

    def _render_generic_content(
        self,
        *,
        message: str,
        action_label: str | None,
        action_url: str | None,
        notification_type: str,
    ) -> str:
        # Normalize the message body: collapse runs of blank lines, escape HTML,
        # preserve paragraph breaks.
        paragraphs: Iterable[str] = (
            "<br>".join(html.escape(line) for line in para.splitlines())
            for para in re.split(r"\n\s*\n", (message or "").strip())
            if para.strip()
        )
        rendered_message = "".join(
            f'<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:{TEXT_MUTED}">{p}</p>'
            for p in paragraphs
        ) or (
            f'<p style="margin:0;font-size:16px;line-height:1.65;color:{TEXT_MUTED}">'
            f"{html.escape(message or '')}</p>"
        )

        body = rendered_message
        absolute_url = self._absolute_url(action_url)
        if action_label and absolute_url:
            body += self._render_button(action_label, absolute_url)
        return body

    # ── Plain-text fallbacks ───────────────────────────────────

    def _text_verification(self, to_name: str, verify_url: str, expires_hours: int) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            f"Hi {first},\n\n"
            "Confirm your email address to activate your TUMBUH account.\n\n"
            f"Verify your email: {verify_url}\n\n"
            f"This link expires in {int(expires_hours)} hours.\n\n"
            "If you didn't create a TUMBUH account, you can safely ignore this email."
        )

    def _text_welcome(self, to_name: str) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        dashboard = f"{self._settings.FRONTEND_URL.rstrip('/')}/beranda"
        return (
            f"Hi {first},\n\n"
            "Welcome to TUMBUH! Your account is verified and ready.\n\n"
            f"Open your dashboard: {dashboard}\n\n"
            "Tip: complete your profile and upload your CV to be discoverable by HR partners."
        )

    def _text_invitation(
        self,
        inviter_name: str,
        org_name: str,
        role_label: str,
        accept_url: str,
        expires_days: int,
    ) -> str:
        return (
            f"{inviter_name} has invited you to join {org_name} on TUMBUH as a {role_label}.\n\n"
            f"Accept invitation: {accept_url}\n\n"
            f"This invitation expires in {int(expires_days)} days."
        )

    def _text_application_status(
        self,
        to_name: str,
        opportunity_title: str,
        company_name: str,
        new_status: str,
        view_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            f"Hi {first},\n\n"
            f"Your application for {opportunity_title} at {company_name} "
            f"is now {new_status}.\n\n"
            f"View applications: {view_url}"
        )

    def _text_generic(
        self, message: str, action_label: str | None, action_url: str | None
    ) -> str:
        absolute_url = self._absolute_url(action_url)
        body = (message or "").strip()
        if action_label and absolute_url:
            return f"{body}\n\n{action_label}: {absolute_url}"
        return body

    # ── Utilities ──────────────────────────────────────────────

    def _absolute_url(self, action_url: str | None) -> str | None:
        if not action_url:
            return None
        if action_url.startswith(("http://", "https://")):
            return action_url
        return urljoin(self._settings.FRONTEND_URL.rstrip("/") + "/", action_url.lstrip("/"))

    @staticmethod
    def _format_recipient(email: str, name: str | None) -> str:
        if not name:
            return email
        safe_name = name.replace('"', "'")
        return f'"{safe_name}" <{email}>'
