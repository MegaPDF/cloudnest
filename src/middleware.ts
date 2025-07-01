import { NextRequest, NextResponse } from 'next/server';
import { LocaleUtils } from './lib/i18n/utils';

export function middleware(request: NextRequest) {
  // Detect language from headers
  const acceptLanguage = request.headers.get('accept-language');
  const detectedLang = LocaleUtils.detectLanguage(acceptLanguage || undefined);
  
  // Get currency from country header or default
  const country = request.headers.get('x-vercel-ip-country') || 'US';
  const detectedCurrency = LocaleUtils.getCurrencyByRegion(country);
  
  // Set headers for the application
  const response = NextResponse.next();
  response.headers.set('x-detected-language', detectedLang);
  response.headers.set('x-detected-currency', detectedCurrency);
  response.headers.set('x-detected-country', country);
  
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

// package.json additional dependencies needed:
/*
{
  "dependencies": {
    "react-intl": "^6.4.7",
    "accept-language-parser": "^1.5.0"
  }
}
*/