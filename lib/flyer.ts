'use client';
import QRCode from 'qrcode';
import { formatDate } from './types';

// Draws a shareable, print-ready flyer for a webinar directly in the
// browser (Canvas API) and triggers a download. The flyer embeds a QR
// code that links straight to the registration form, so it works as a
// WhatsApp / Instagram / print share without anyone having to type a
// link. Nothing is uploaded or posted anywhere.

const W = 1080;
const H = 1350;

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
// line if there's more text than fits. Returns the y position after the
// last drawn line so callers can lay out what comes next.
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
}) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Your browser does not support generating images here.');

    const margin = 72;

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#A8436B');
    bg.addColorStop(1, '#5c2540');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(W * 0.9, H * 0.06, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.05, H * 0.98, 220, 0, Math.PI * 2);
    ctx.fill();

    // Wordmark + free badge
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 28px Arial, sans-serif';
    ctx.fillText('SEMINAR DESK', margin, 90);
    ctx.font = '700 24px Arial, sans-serif';
    const badge = 'FREE WEBINAR';
    const badgeWidth = ctx.measureText(badge).width + 44;
    ctx.fillStyle = '#FBE6EE';
    roundRect(ctx, W - margin - badgeWidth, 58, badgeWidth, 46, 23);
    ctx.fill();
    ctx.fillStyle = '#A8436B';
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

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 54px Arial, sans-serif';
    const afterTitleY = wrapText(ctx, w.title, margin, 280, W - margin * 2, 62, 3);

    // Theme / description
    ctx.font = '400 26px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const afterDescY = wrapText(ctx, w.description, margin, afterTitleY + 44, W - margin * 2, 36, 3);

    // Info card
    const cardY = afterDescY + 50;
    const cardH = 190;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, margin, cardY, W - margin * 2, cardH, 20);
    ctx.fill();
    const col1 = margin + 40;
    const col2 = margin + (W - margin * 2) / 2 + 10;
    infoRow(ctx, col1, cardY + 62, 'Date', formatDate(w.starts_at, false));
    infoRow(ctx, col2, cardY + 62, 'Time', new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(w.starts_at)) + ' IST');
    infoRow(ctx, col1, cardY + 146, 'Mode', 'Online — Live Session');
    infoRow(ctx, col2, cardY + 146, 'Certificate', w.certificate ? 'Yes, e-certificate' : 'Not provided');

    // QR code + register CTA
    const qrSize = 230;
    const qrY = cardY + cardH + 46;
    const registerUrl = `${location.origin}/register/${w.id}`;
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, registerUrl, { width: qrSize, margin: 1, color: { dark: '#3d1a2b', light: '#ffffff' } });
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, margin, qrY, qrSize + 32, qrSize + 32, 20);
    ctx.fill();
    ctx.drawImage(qrCanvas, margin + 16, qrY + 16, qrSize, qrSize);

    const textX = margin + qrSize + 32 + 40;
    const textWidth = W - margin - textX;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 32px Arial, sans-serif';
    wrapText(ctx, 'Scan to register', textX, qrY + 60, textWidth, 40, 2);
    ctx.font = '400 24px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    wrapText(ctx, 'Seats are limited — reserve your spot in under a minute.', textX, qrY + 130, textWidth, 32, 3);

    // Footer: organizer + contact
    const footerY = H - 60;
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
