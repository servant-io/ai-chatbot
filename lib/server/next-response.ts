import 'server-only';
import { NextResponse } from 'next/server';

export const toNextResponse = (response: Response) =>
  new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
