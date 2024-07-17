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
    '/api/gmail',  // Add this line
  ],
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};