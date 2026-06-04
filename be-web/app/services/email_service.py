import html
import logging
import re
from typing import Iterable
from urllib.parse import urljoin

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


# ── Brand palette (from fe-web/public/tumbuh.svg) ─────────────────
# The 4 colors in the tumbuh. logo are the source of truth.
LEAF_BRIGHT = "#58C855"        # SVG: bright leaf top
LEAF_MEDIUM = "#357963"        # SVG: medium leaf body
ACCENT_BLUE = "#1E3A8A"        # SVG: royal blue
ROOT_DEEP = "#0A1D3D"          # SVG: dark navy stem

# Brand-mapped roles
BRAND_PRIMARY = LEAF_BRIGHT
BRAND_DARK = LEAF_MEDIUM
BRAND_ACCENT = ACCENT_BLUE
BRAND_DEEP = ROOT_DEEP
BRAND_HEADER_BG = LEAF_MEDIUM
BRAND_HEADER_ACCENT = LEAF_BRIGHT

# Text
TEXT_DEFAULT = ROOT_DEEP
TEXT_MUTED = ACCENT_BLUE
TEXT_LIGHT = "#4A5F8C"
TEXT_INVERSE = "#ffffff"

# Surfaces
SURFACE_BORDER = "#E6ECF5"
SURFACE_MUTED_BG = "#F4F7FB"
PAGE_BG = "#F4F7FB"

FONT_STACK = (
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', "
    "Roboto, Helvetica, Arial, sans-serif"
)


# Status badge palette (for application status emails).
STATUS_PALETTE: dict[str, tuple[str, str]] = {
    "accepted": ("#dcfce7", "#166534"),
    "reviewing": ("#dbeafe", "#1e40af"),
    "rejected": ("#fee2e2", "#991b1b"),
    "shortlisted": ("#fef3c7", "#92400e"),
    "interview": ("#ede9fe", "#5b21b6"),
    "info": ("#e0f2fe", "#075985"),
    "success": ("#dcfce7", "#166534"),
    "warning": ("#fef3c7", "#92400e"),
    "error": ("#fee2e2", "#991b1b"),
}


# Accent palette for info boxes.
INFO_BOX_PALETTE: dict[str, tuple[str, str, str]] = {
    "primary": ("#e8f5e9", BRAND_DARK, "#c8e6c9"),
    "warning": ("#fef3c7", "#92400e", "#fcd34d"),
    "info": ("#e0f2fe", "#075985", "#7dd3fc"),
    "danger": ("#fee2e2", "#991b1b", "#fca5a5"),
}


class EmailService:
    """Branded transactional email service for the tumbuh. platform.

    All public ``send_*`` methods are typed: they take semantic
    parameters (not raw HTML) and render a consistent layout that
    matches the frontend's tumbuh. brand.
    """

    def __init__(self):
        self._settings = get_settings()

    @property
    def is_configured(self) -> bool:
        return bool(
            self._settings.EMAIL_ENABLED
            and self._settings.RESEND_API_KEY
            and self._settings.EMAIL_FROM
        )

    # ── Public typed send methods ──────────────────────────────

    def send_verification_email(
        self,
        to_email: str,
        to_name: str,
        verify_url: str,
        expires_hours: int,
    ) -> bool:
        content = self._render_verification_content(
            to_name=to_name, verify_url=verify_url, expires_hours=expires_hours,
        )
        return self._send(
            to_email,
            "Verify your tumbuh. email",
            subject_lead="Verify your email",
            preview_text="Confirm your email to activate your tumbuh. account.",
            content_html=content,
            text_body=self._text_verification(to_name, verify_url, expires_hours),
            to_name=to_name,
        )

    def send_password_reset_email(
        self,
        to_email: str,
        to_name: str,
        reset_url: str,
        expires_hours: int,
    ) -> bool:
        content = self._render_password_reset_content(
            to_name=to_name, reset_url=reset_url, expires_hours=expires_hours,
        )
        return self._send(
            to_email,
            "Reset your tumbuh. password",
            subject_lead="Reset your password",
            preview_text="Click the link below to set a new password for your tumbuh. account.",
            content_html=content,
            text_body=self._text_password_reset(to_name, reset_url, expires_hours),
            to_name=to_name,
        )

    def send_welcome_email(self, to_email: str, to_name: str) -> bool:
        content = self._render_welcome_content(to_name=to_name)
        return self._send(
            to_email,
            "Welcome to tumbuh.",
            subject_lead=f"Welcome, {to_name.split(' ')[0] if to_name else 'there'}",
            preview_text="Your tumbuh. account is ready. Here's how to get started.",
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
        content = self._render_invitation_content(
            inviter_name=inviter_name, org_name=org_name, role_label=role_label,
            accept_url=accept_url, expires_days=expires_days,
        )
        return self._send(
            to_email,
            f"Join {org_name} on tumbuh.",
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
        normalized = (new_status or "").lower()
        bg, fg = STATUS_PALETTE.get(normalized, STATUS_PALETTE["info"])
        content = self._render_application_status_content(
            to_name=to_name, opportunity_title=opportunity_title,
            company_name=company_name, status_label=new_status.replace("_", " ").title(),
            status_bg=bg, status_fg=fg, view_url=view_url,
        )
        return self._send(
            to_email,
            f"Application status updated: {normalized.title()}",
            subject_lead=f"Application update: {opportunity_title}",
            preview_text=(
                f"Your application for {opportunity_title} at {company_name} "
                f"is now {normalized}."
            ),
            content_html=content,
            text_body=self._text_application_status(
                to_name, opportunity_title, company_name, new_status, view_url,
            ),
            to_name=to_name,
        )

    def send_new_applicant_email(
        self,
        to_email: str,
        to_name: str,
        *,
        opportunity_title: str,
        company_name: str,
        applicant_name: str,
        review_url: str,
    ) -> bool:
        content = self._render_new_applicant_content(
            to_name=to_name, opportunity_title=opportunity_title,
            company_name=company_name, applicant_name=applicant_name,
            review_url=review_url,
        )
        return self._send(
            to_email,
            f"New applicant for {opportunity_title}",
            subject_lead="New applicant",
            preview_text=f"{applicant_name} just applied to {opportunity_title} at {company_name}.",
            content_html=content,
            text_body=self._text_new_applicant(
                to_name, opportunity_title, company_name, applicant_name, review_url,
            ),
            to_name=to_name,
        )

    def send_new_opportunity_email(
        self,
        to_email: str,
        to_name: str,
        *,
        opportunity_title: str,
        company_name: str,
        work_mode: str | None,
        opportunity_type: str | None,
        view_url: str,
    ) -> bool:
        content = self._render_new_opportunity_content(
            to_name=to_name, opportunity_title=opportunity_title,
            company_name=company_name, work_mode=work_mode,
            opportunity_type=opportunity_type, view_url=view_url,
        )
        return self._send(
            to_email,
            f"New opportunity at {company_name}",
            subject_lead=f"New opportunity: {opportunity_title}",
            preview_text=f"{company_name} just posted a new {opportunity_type or 'role'}: {opportunity_title}.",
            content_html=content,
            text_body=self._text_new_opportunity(
                to_name, opportunity_title, company_name, work_mode, opportunity_type, view_url,
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
        content = self._render_generic_content(
            message=message, action_label=action_label, action_url=action_url,
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

    def send_email(
        self,
        to_email: str,
        subject: str,
        *,
        html_body: str,
        text_body: str,
        to_name: str | None = None,
    ) -> bool:
        """Raw escape hatch. Prefer the typed methods above."""
        return self._send(
            to_email,
            subject,
            subject_lead=None,
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

    def _logo_url(self) -> str:
        return f"{self._settings.FRONTEND_URL.rstrip('/')}/tumbuh.svg"

    def _absolute_url(self, action_url: str | None) -> str | None:
        if not action_url:
            return None
        if action_url.startswith(("http://", "https://")):
            return action_url
        return urljoin(self._settings.FRONTEND_URL.rstrip("/") + "/", action_url.lstrip("/"))

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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAGE_BG}">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid {SURFACE_BORDER}">
        <tr>
          <td style="background-color:{BRAND_HEADER_BG};background-image:linear-gradient(135deg,{LEAF_BRIGHT} 0%,{LEAF_MEDIUM} 50%,{ROOT_DEEP} 100%);padding:28px 32px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:14px">
                  <img src="{self._logo_url()}" alt="tumbuh." width="44" height="44" style="display:block;border:0;outline:none;text-decoration:none" />
                </td>
                <td style="vertical-align:middle">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1.2">tumbuh.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="height:3px;background:{LEAF_BRIGHT};font-size:0;line-height:0">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:40px 32px">
            {content_html}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;background:{SURFACE_MUTED_BG};border-top:1px solid {SURFACE_BORDER}">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:{TEXT_DEFAULT};letter-spacing:-0.01em">tumbuh.</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:{TEXT_LIGHT}">
              &copy; 2026 tumbuh. &middot; from the intern
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:{TEXT_LIGHT};max-width:600px;text-align:center">
        Need help? Reply to this email.
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
        fg: str = TEXT_INVERSE,
    ) -> str:
        return (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">'
            '<tr><td style="background:' + bg + ';border-radius:10px;'
            'box-shadow:0 2px 4px rgba(10,29,61,0.15)">'
            f'<a href="{html.escape(url)}" target="_blank" rel="noopener" '
            'style="display:inline-block;padding:14px 32px;color:' + fg + ';'
            'text-decoration:none;font-weight:600;font-size:15px;line-height:1.2;'
            'mso-padding-alt:0;letter-spacing:0.01em">'
            f"{html.escape(label)}</a>"
            "</td></tr></table>"
        )

    def _render_status_pill(self, label: str, bg: str, fg: str) -> str:
        return (
            '<p style="margin:0 0 20px;display:inline-block;background:' + bg + ';color:' + fg + ';'
            'padding:7px 16px;border-radius:999px;font-size:11px;font-weight:700;'
            'text-transform:uppercase;letter-spacing:0.1em;line-height:1.2">'
            f"{html.escape(label)}</p>"
        )

    def _render_info_box(
        self,
        text: str,
        *,
        accent: str = "primary",
    ) -> str:
        bg, fg, _ = INFO_BOX_PALETTE.get(accent, INFO_BOX_PALETTE["primary"])
        return (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
            'style="margin:24px 0;background:' + bg + ';border-left:4px solid ' + fg + ';border-radius:6px">'
            '<tr><td style="padding:14px 18px;font-size:14px;line-height:1.55;color:' + fg + '">'
            f"{text}</td></tr></table>"
        )

    def _render_muted_note(self, text: str) -> str:
        return (
            f'<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:{TEXT_LIGHT}">'
            f"{text}</p>"
        )

    def _render_link_fallback(self, url: str) -> str:
        return (
            f'<p style="margin:18px 0 0;padding-top:18px;border-top:1px solid {SURFACE_BORDER};'
            f'font-size:12px;line-height:1.6;color:{TEXT_LIGHT};word-break:break-all">'
            f"Button not working? Copy this link into your browser:<br>"
            f'<a href="{html.escape(url)}" style="color:{BRAND_DARK};text-decoration:underline">'
            f"{html.escape(url)}</a></p>"
        )

    # ── Per-template content ───────────────────────────────────

    def _render_verification_content(
        self, *, to_name: str, verify_url: str, expires_hours: int
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            self._greeting(first)
            + self._heading("Verify your email")
            + self._paragraph(
                f"Welcome to tumbuh.! Tap the button below to confirm your email "
                f"and activate your account."
            )
            + self._render_button("Verify email", verify_url)
            + self._render_info_box(
                f"This link expires in {int(expires_hours)} hours. "
                "If you didn't create a tumbuh. account, you can safely ignore this email.",
                accent="info",
            )
            + self._render_link_fallback(verify_url)
        )

    def _render_password_reset_content(
        self, *, to_name: str, reset_url: str, expires_hours: int
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            self._greeting(first)
            + self._heading("Reset your password")
            + self._paragraph(
                f"We received a request to reset the password for your tumbuh. account. "
                f"Tap the button below to choose a new one."
            )
            + self._render_button("Reset password", reset_url)
            + self._render_info_box(
                f"This link expires in {int(expires_hours)} hour(s). "
                "If you didn't request a password reset, you can safely ignore this email — "
                "your password will stay the same.",
                accent="warning",
            )
            + self._render_link_fallback(reset_url)
        )

    def _render_welcome_content(self, *, to_name: str) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        dashboard_url = f"{self._settings.FRONTEND_URL.rstrip('/')}/beranda"
        return (
            self._greeting(first)
            + self._heading(f"Welcome to tumbuh., {first}!")
            + self._paragraph(
                "Your account is verified and ready. tumbuh. helps IPB students discover "
                "internships, externships, and entry-level opportunities — and helps "
                "companies find great IPB talent."
            )
            + self._render_button("Open your dashboard", dashboard_url)
            + self._render_info_box(
                "Tip: complete your profile and upload your CV to be discoverable by HR partners.",
                accent="primary",
            )
        )

    def _render_invitation_content(
        self,
        *,
        inviter_name: str,
        org_name: str,
        role_label: str,
        accept_url: str,
        expires_days: int,
    ) -> str:
        return (
            self._heading("You've been invited")
            + self._paragraph(
                f"<strong>{html.escape(inviter_name)}</strong> has invited you to join "
                f"<strong>{html.escape(org_name)}</strong> on tumbuh. as a "
                f"<strong>{html.escape(role_label)}</strong>."
            )
            + self._paragraph(
                "tumbuh. helps IPB students and companies connect through internships and "
                "entry-level opportunities. Accept this invite to start managing roles, "
                "opportunities, and applicants with your team.",
                muted=True,
            )
            + self._render_button("Accept invitation", accept_url)
            + self._render_info_box(
                f"This invitation expires in {int(expires_days)} days. "
                "If you weren't expecting this email, you can ignore it.",
                accent="info",
            )
            + self._render_link_fallback(accept_url)
        )

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
        return (
            self._greeting(first)
            + self._render_status_pill(status_label, status_bg, status_fg)
            + self._heading("Application update")
            + self._paragraph(
                f"Your application for <strong>{html.escape(opportunity_title)}</strong> at "
                f"<strong>{html.escape(company_name)}</strong> has been updated."
            )
            + self._render_button("View my applications", view_url)
            + self._render_muted_note("Log in to tumbuh. to see the full conversation and next steps.")
        )

    def _render_new_applicant_content(
        self,
        *,
        to_name: str,
        opportunity_title: str,
        company_name: str,
        applicant_name: str,
        review_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            self._greeting(first)
            + self._heading("New applicant")
            + self._paragraph(
                f"<strong>{html.escape(applicant_name)}</strong> just applied to your "
                f"<strong>{html.escape(opportunity_title)}</strong> role at "
                f"<strong>{html.escape(company_name)}</strong>."
            )
            + self._render_button("Review applicant", review_url)
            + self._render_muted_note("Open the application to view their profile, CV, and cover letter.")
        )

    def _render_new_opportunity_content(
        self,
        *,
        to_name: str,
        opportunity_title: str,
        company_name: str,
        work_mode: str | None,
        opportunity_type: str | None,
        view_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        meta_bits: list[str] = []
        if opportunity_type:
            meta_bits.append(html.escape(opportunity_type))
        if work_mode:
            meta_bits.append(html.escape(work_mode))
        meta_line = ""
        if meta_bits:
            joined = " &middot; ".join(meta_bits)
            meta_line = (
                f'<p style="margin:0 0 12px;font-size:12px;font-weight:600;'
                f'color:{TEXT_MUTED};text-transform:uppercase;letter-spacing:0.1em">'
                f"{joined}</p>"
            )
        return (
            self._greeting(first)
            + self._heading("New opportunity")
            + meta_line
            + self._paragraph(
                f"<strong>{html.escape(company_name)}</strong> just posted a new role: "
                f"<strong>{html.escape(opportunity_title)}</strong>."
            )
            + self._render_button("View opportunity", view_url)
            + self._render_muted_note("You're seeing this because you follow this company on tumbuh.")
        )

    def _render_generic_content(
        self,
        *,
        message: str,
        action_label: str | None,
        action_url: str | None,
        notification_type: str,
    ) -> str:
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

    # ── Small content helpers ──────────────────────────────────

    def _greeting(self, first_name: str) -> str:
        return (
            f'<p style="margin:0 0 8px;font-size:14px;font-weight:600;'
            f'color:{TEXT_MUTED};letter-spacing:0.02em">Hi {html.escape(first_name)},</p>'
        )

    def _heading(self, text: str) -> str:
        return (
            f'<h1 style="margin:0 0 16px;font-size:28px;font-weight:700;'
            f'color:{TEXT_DEFAULT};line-height:1.25;letter-spacing:-0.02em">'
            f"{html.escape(text)}</h1>"
        )

    def _paragraph(self, text: str, *, muted: bool = False) -> str:
        color = TEXT_LIGHT if muted else TEXT_MUTED
        size = "15px" if muted else "16px"
        return (
            f'<p style="margin:0 0 14px;font-size:{size};line-height:1.65;color:{color}">'
            f"{text}</p>"
        )

    # ── Plain-text fallbacks ───────────────────────────────────

    def _text_verification(self, to_name: str, verify_url: str, expires_hours: int) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            f"Hi {first},\n\n"
            "Welcome to tumbuh.! Confirm your email to activate your account.\n\n"
            f"Verify your email: {verify_url}\n\n"
            f"This link expires in {int(expires_hours)} hours.\n\n"
            "If you didn't create a tumbuh. account, you can safely ignore this email."
        )

    def _text_password_reset(self, to_name: str, reset_url: str, expires_hours: int) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            f"Hi {first},\n\n"
            "We received a request to reset the password for your tumbuh. account.\n\n"
            f"Reset your password: {reset_url}\n\n"
            f"This link expires in {int(expires_hours)} hour(s).\n\n"
            "If you didn't request a password reset, you can safely ignore this email — "
            "your password will stay the same."
        )

    def _text_welcome(self, to_name: str) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        dashboard = f"{self._settings.FRONTEND_URL.rstrip('/')}/beranda"
        return (
            f"Hi {first},\n\n"
            "Welcome to tumbuh.! Your account is verified and ready.\n\n"
            f"Open your dashboard: {dashboard}\n\n"
            "Tip: complete your profile and upload your CV to be discoverable by HR partners."
        )

    def _text_invitation(
        self, inviter_name: str, org_name: str, role_label: str, accept_url: str, expires_days: int,
    ) -> str:
        return (
            f"{inviter_name} has invited you to join {org_name} on tumbuh. as a {role_label}.\n\n"
            f"Accept invitation: {accept_url}\n\n"
            f"This invitation expires in {int(expires_days)} days."
        )

    def _text_application_status(
        self, to_name: str, opportunity_title: str, company_name: str, new_status: str, view_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            f"Hi {first},\n\n"
            f"Your application for {opportunity_title} at {company_name} "
            f"is now {new_status}.\n\n"
            f"View applications: {view_url}"
        )

    def _text_new_applicant(
        self, to_name: str, opportunity_title: str, company_name: str, applicant_name: str, review_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        return (
            f"Hi {first},\n\n"
            f"{applicant_name} just applied to your {opportunity_title} role at {company_name}.\n\n"
            f"Review applicant: {review_url}"
        )

    def _text_new_opportunity(
        self, to_name: str, opportunity_title: str, company_name: str,
        work_mode: str | None, opportunity_type: str | None, view_url: str,
    ) -> str:
        first = to_name.split(" ")[0] if to_name else "there"
        meta_bits = [b for b in (opportunity_type, work_mode) if b]
        meta = f" ({' / '.join(meta_bits)})" if meta_bits else ""
        return (
            f"Hi {first},\n\n"
            f"{company_name} just posted a new role{meta}: {opportunity_title}.\n\n"
            f"View opportunity: {view_url}\n\n"
            "You're seeing this because you follow this company on tumbuh."
        )

    def _text_generic(self, message: str, action_label: str | None, action_url: str | None) -> str:
        absolute_url = self._absolute_url(action_url)
        body = (message or "").strip()
        if action_label and absolute_url:
            return f"{body}\n\n{action_label}: {absolute_url}"
        return body

    # ── Utilities ──────────────────────────────────────────────

    @staticmethod
    def _format_recipient(email: str, name: str | None) -> str:
        if not name:
            return email
        safe_name = name.replace('"', "'")
        return f'"{safe_name}" <{email}>'
