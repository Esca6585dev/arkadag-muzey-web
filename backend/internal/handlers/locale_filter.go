package handlers

import (
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

var localeCodeRe = regexp.MustCompile(`^[a-z]{2}$`)

// explicitLocale returns the locale requested via ?locale= or the X-Locale header
// (never Accept-Language), or "" when none/invalid.
func explicitLocale(c *fiber.Ctx) string {
	l := strings.ToLower(strings.TrimSpace(c.Query("locale")))
	if l == "" {
		l = strings.ToLower(strings.TrimSpace(c.Get("X-Locale")))
	}
	if !localeCodeRe.MatchString(l) {
		return ""
	}
	return l
}

// filterByLocale keeps only rows whose translatable JSON column has text in the requested
// locale. Imported legacy content exists in one language per row, while hand-made rows
// usually have all languages, so each language version of the site shows its own stories.
func filterByLocale(c *fiber.Ctx, q *gorm.DB, column string) *gorm.DB {
	l := explicitLocale(c)
	if l == "" || !identOK(column) {
		return q
	}
	return q.Where("COALESCE(JSON_UNQUOTE(JSON_EXTRACT("+column+", ?)), '') <> ''", "$."+l)
}

var identRe = regexp.MustCompile(`^[a-z_][a-z0-9_.]*$`)

func identOK(s string) bool { return identRe.MatchString(s) }
