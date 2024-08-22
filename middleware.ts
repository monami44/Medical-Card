import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [
    '/', 
    '/profile', 
    '/register', 
    '/api/webhooks/clerk', 
    '/api/test-insert', 
    '/api/hello',
    '/api/users',
    '/api/gmail',
    '/api/chat',
  ] as const,
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};