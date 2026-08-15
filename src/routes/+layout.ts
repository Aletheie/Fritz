// The learning UI relies on IndexedDB and browser speech APIs. API routes remain
// server-side even though pages are rendered as a client-side application.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'always';
