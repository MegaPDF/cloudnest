// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';

// Create NextAuth handler
const handler = NextAuth(authConfig);

// Export handlers for both GET and POST requests
export { handler as GET, handler as POST };

// Export auth configuration for use in other files
export { authConfig };