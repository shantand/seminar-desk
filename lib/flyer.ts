'use client';
import QRCode from 'qrcode';
import { formatDate } from './types';

// Draws a shareable, print-ready flyer for a webinar directly in the
// browser (Canvas API) and triggers a download. The flyer embeds a QR
// code that links straight to the registration form, so it works as a
// WhatsApp / Instagram / print share without anyone having to type a
// link. Nothing is uploaded or posted anywhere. Canvas height is
// computed from the actual title/description content, so nothing gets
// truncated — a longer theme just makes a taller flyer.

const W = 1080;

export const FLYER_COLORS = ['#0B3D2E', '#A8436B', '#1B3A6B', '#6B1B2B', '#26272B', '#4B2168'] as const;
const DEFAULT_COLOR = FLYER_COLORS[0];

function hexToRgb(hex: string) {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const n = parseInt(full, 16) || 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

// Mixes a hex color toward white (positive amount) or black (negative
// amount), so every flyer color can derive a matching gradient, badge,
// QR tint and footer tone instead of hardcoding a single palette.
function shade(hex: string, amount: number) {
    const { r, g, b } = hexToRgb(hex);
    const target = amount < 0 ? 0 : 255;
    const p = Math.min(1, Math.abs(amount));
    return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Wraps text to fit maxWidth, draws up to maxLines, ellipsizing the last
// line if there's more text than fits. Used only for the app's own short,
// fixed CTA copy — never for the webinar's own title/theme, which must
// never be cut off.
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = test;
        }
        if (lines.length === maxLines)
            break;
    }
    if (current && lines.length < maxLines)
        lines.push(current);
    if (lines.length === maxLines) {
        let last = lines[maxLines - 1];
        while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1)
            last = last.slice(0, -1);
        lines[maxLines - 1] = `${last}…`;
    }
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
}

// Wraps text to fit maxWidth with no line cap and no truncation, so the
// webinar's own title and theme always render in full. Respects blank
// lines and manual line breaks the organizer typed in (\n), instead of
// collapsing everything into one paragraph.
function wrapAll(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const para of text.split('\n')) {
        if (para.trim() === '') {
            lines.push('');
            continue;
        }
        let current = '';
        for (const word of para.split(' ')) {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current);
                current = word;
            }
            else {
                current = test;
            }
        }
        if (current)
            lines.push(current);
    }
    return lines;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number): number {
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
}

function infoRow(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string) {
    ctx.font = '600 22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.font = '600 30px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(value, x, y + 36);
}

export async function downloadFlyer(w: {
    id: string;
    title: string;
    course: string;
    batch: string;
    description: string;
    organizer: string;
    starts_at: string;
    closes_at: string;
    certificate: number;
    contact_phone: string;
}, color: string = DEFAULT_COLOR) {
    // A throwaway context, just to measure how many lines the title and
    // description will need before the real canvas is sized — font
    // metrics don't depend on canvas dimensions, so this is accurate.
    const measurer = document.createElement('canvas').getContext('2d');
    if (!measurer)
        throw new Error('Your browser does not support generating images here.');

    const margin = 72;
    const titleFont = '700 54px Arial, sans-serif';
    const titleLineHeight = 62;
    const descFont = '400 26px Arial, sans-serif';
    const descLineHeight = 36;

    measurer.font = titleFont;
    const titleLines = wrapAll(measurer, w.title, W - margin * 2);
    measurer.font = descFont;
    const descLines = wrapAll(measurer, w.description, W - margin * 2);

    const titleY = 280;
    const afterTitleY = titleY + titleLines.length * titleLineHeight;
    const afterDescY = afterTitleY + 44 + descLines.length * descLineHeight;

    const fields: [string, string][] = [
        ['Date', formatDate(w.starts_at, false)],
        ['Time', new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(w.starts_at)) + ' IST'],
        ['Mode', 'Online — Live Session'],
    ];
    if (w.certificate)
        fields.push(['Certificate', 'Yes, e-certificate']);
    const cardY = afterDescY + 50;
    const rows = Math.ceil(fields.length / 2);
    const cardH = rows === 1 ? 106 : 190;

    const qrSize = 230;
    const qrBoxW = qrSize + 32;
    const qrY = cardY + cardH + 46;
    const footerY = qrY + qrBoxW + 90;
    const H = footerY + 70;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Your browser does not support generating images here.');

    const badgeTint = shade(color, 0.88);
    const badgeText = shade(color, -0.45);
    const linkTint = shade(color, 0.6);
    const qrDark = shade(color, -0.5);

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, color);
    bg.addColorStop(1, shade(color, -0.65));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(W * 0.9, H * 0.06, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.05, H * 0.98, 220, 0, Math.PI * 2);
    ctx.fill();

    // Free badge
    ctx.font = '700 24px Arial, sans-serif';
    const badge = 'FREE WEBINAR';
    const badgeWidth = ctx.measureText(badge).width + 44;
    ctx.fillStyle = badgeTint;
    roundRect(ctx, W - margin - badgeWidth, 58, badgeWidth, 46, 23);
    ctx.fill();
    ctx.fillStyle = badgeText;
    ctx.textAlign = 'center';
    ctx.fillText(badge, W - margin - badgeWidth / 2, 89);
    ctx.textAlign = 'left';

    // Course pill
    ctx.font = '600 24px Arial, sans-serif';
    const courseLabel = w.course.toUpperCase();
    const pillWidth = ctx.measureText(courseLabel).width + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, margin, 150, pillWidth, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(courseLabel, margin + 22, 182);

    // Title — drawn in full, using the same wrapping computed above
    ctx.fillStyle = '#ffffff';
    ctx.font = titleFont;
    drawLines(ctx, titleLines, margin, titleY, titleLineHeight);

    // Theme / description — drawn in full, preserving the organizer's own
    // line breaks and blank lines
    ctx.font = descFont;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    drawLines(ctx, descLines, margin, afterTitleY + 44, descLineHeight);

    // Info card — only fields that actually have a value are shown, so a
    // webinar with no certificate simply omits that row instead of saying
    // "Not provided".
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, margin, cardY, W - margin * 2, cardH, 20);
    ctx.fill();
    const col1 = margin + 40;
    const col2 = margin + (W - margin * 2) / 2 + 10;
    fields.forEach(([label, value], i) => infoRow(ctx, i % 2 === 0 ? col1 : col2, cardY + 62 + Math.floor(i / 2) * 84, label, value));

    // QR code + register CTA
    const registerUrl = `${location.origin}/register/${w.id}`;
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, registerUrl, { width: qrSize, margin: 1, color: { dark: qrDark, light: '#ffffff' } });
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, margin, qrY, qrBoxW, qrBoxW, 20);
    ctx.fill();
    ctx.drawImage(qrCanvas, margin + 16, qrY + 16, qrSize, qrSize);

    const textX = margin + qrBoxW + 40;
    const textWidth = W - margin - textX;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 32px Arial, sans-serif';
    wrapText(ctx, 'Scan or tap to register', textX, qrY + 56, textWidth, 40, 2);
    ctx.font = '400 25px Arial, sans-serif';
    ctx.fillStyle = linkTint;
    wrapText(ctx, 'Seats are limited — reserve your spot now.', textX, qrY + 126, textWidth, 34, 3);

    // Footer: organizer + contact, with the Seminar Desk credit below
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 34);
    ctx.lineTo(W - margin, footerY - 34);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 26px Arial, sans-serif';
    ctx.fillText(w.organizer, margin, footerY);
    if (w.contact_phone) {
        ctx.font = '400 24px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'right';
        ctx.fillText(w.contact_phone, W - margin, footerY);
        ctx.textAlign = 'left';
    }
    ctx.font = '400 18px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Seminar Desk', margin, footerY + 30);

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not generate the image.')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${w.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'webinar'}-flyer.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
