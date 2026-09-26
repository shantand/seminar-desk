import { getAdminUser } from '@/lib/auth';
import { leadsForExport } from '@/lib/server';
export const dynamic = 'force-dynamic';

const CSV_COLUMNS = ['name', 'phone', 'email', 'college', 'city', 'situation', 'course', 'batch', 'webinar_title', 'webinar_starts_at', 'created_at'] as const;

function csvCell(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
    const u = await getAdminUser();
    if (!u)
        return Response.json({ error: 'Please sign in.' }, { status: 401 });
    const leads = await leadsForExport(u.userId);
    const lines = [CSV_COLUMNS.join(',')];
    for (const l of leads)
        lines.push(CSV_COLUMNS.map(c => csvCell((l as Record<string, unknown>)[c])).join(','));
    const csv = lines.join('\r\n') + '\r\n';
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="registrations-${stamp}.csv"`,
            'Cache-Control': 'no-store'
        }
    });
}
