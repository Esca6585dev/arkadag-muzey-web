import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/tk/admin", "/ru/admin", "/en/admin", "/tk/account", "/ru/account", "/en/account"] }],
    sitemap: siteUrl("/sitemap.xml"),
  };
}
