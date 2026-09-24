'use client';
import { formatDate } from './types';

// Draws a 1080x1080 Instagram feed post for a webinar directly in the
// browser (Canvas API) and triggers a download. Nothing is uploaded or
// posted anywhere - this only produces an image the organizer downloads
// and shares themselves.

const SIZE = 1080;

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

export async function downloadInstagramPost(w: {
    id: string;
    title: string;
    course: string;
    batch: string;
    starts_at: string;
    organizer: string;
}) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Your browser does not support generating images here.');

    const margin = 70;

    // Background
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bg.addColorStop(0, '#A8436B');
    bg.addColorStop(1, '#6d2c46');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.arc(SIZE * 0.88, SIZE * 0.12, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(SIZE * 0.08, SIZE * 0.95, 180, 0, Math.PI * 2);
    ctx.fill();

    // Wordmark
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 30px Arial, sans-serif';
    ctx.fillText('SEMINAR DESK', margin, 100);

    // Course pill
    ctx.font = '600 26px Arial, sans-serif';
    const courseLabel = w.course.toUpperCase();
    const pillWidth = ctx.measureText(courseLabel).width + 48;
    ctx.fillStyle = '#FBE6EE';
    roundRect(ctx, margin, 150, pillWidth, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#A8436B';
    ctx.fillText(courseLabel, margin + 24, 184);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 58px Arial, sans-serif';
    const afterTitleY = wrapText(ctx, w.title, margin, 300, SIZE - margin * 2, 68, 4);

    // Date and batch
    ctx.font = '500 34px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${formatDate(w.starts_at)} IST`, margin, afterTitleY + 50);
    ctx.font = '400 27px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(w.batch, margin, afterTitleY + 92);

    // CTA bar
    const ctaY = SIZE - 190;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, margin, ctaY, SIZE - margin * 2, 84, 42);
    ctx.fill();
    ctx.fillStyle = '#A8436B';
    ctx.font = '700 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Register — link in bio', SIZE / 2, ctaY + 53);
    ctx.textAlign = 'left';

    // Organizer
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '400 24px Arial, sans-serif';
    ctx.fillText(w.organizer, margin, SIZE - 40);

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not generate the image.')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${w.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'webinar'}-instagram-post.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
