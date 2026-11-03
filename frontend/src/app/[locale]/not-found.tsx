import { useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <main className="container-x flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Landmark className="size-9" strokeWidth={1.4} />
      </div>
      <p className="eyebrow before:hidden">404</p>
      <h1 className="heading-lg">{t("pageNotFound")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("pageNotFoundText")}</p>
      <Button asChild className="mt-8 rounded-full">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </main>
  );
}
