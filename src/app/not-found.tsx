'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Page Not Found</h2>
      <Link href="/" style={{ color: '#10b981', marginTop: '1rem', display: 'inline-block' }}>
        Return Home
      </Link>
    </div>
  );
}
