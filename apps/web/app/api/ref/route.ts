import { NextResponse, type NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';
import { isRefSource } from '@/lib/ref';

export const runtime = 'edge';

/**
 * POST /api/ref with the source as the body: adds one to today's count for that source
 * (ref_visits). Only known sources; nothing about the visitor is stored. Tells whether links in
 * the X posts bring anyone, which decides whether they are worth X's link price.
 */
export async function POST(req: NextRequest) {
  const src = (await req.text()).trim();
  const cf = await getCF();
  if (!isRefSource(src) || !cf?.env.DB) return new NextResponse(null, { status: 204 });
  await cf.env.DB.prepare(
    `INSERT INTO ref_visits (day, src, n) VALUES (date('now'), ?, 1)
     ON CONFLICT(day, src) DO UPDATE SET n = n + 1`
  )
    .bind(src)
    .run();
  return new NextResponse(null, { status: 204 });
}
