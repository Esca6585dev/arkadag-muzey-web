import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

const PROTECTED = [/^\/(tk|ru|en)\/admin(\/|$)/, /^\/(tk|ru|en)\/account(\/|$)/];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Guard admin/account areas: redirect to login when no session cookie exists.
  // (Role checks happen client-side + API-side; this only avoids flashing private UI.)
  if (PROTECTED.some((re) => re.test(pathname))) {
    const hasSession = request.cookies.has("access_token") || request.cookies.has("refresh_token");
    if (!hasSession) {
      const locale = pathname.split("/")[1] || routing.defaultLocale;
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return intl(request);
}

export const config = {
  matcher: ["/((?!api|uploads|_next|_vercel|.*\\..*).*)"],
};
