package handlers

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
)

// Permanent redirects for article URLs of the old Joomla site, so bookmarks and search
// results keep working. nginx rewrites the old URL shapes to this endpoint
// (see deploy/templates/nginx.conf).
func init() {
	Register(func(d *Deps) {
		d.Public.Get("/legacy/article", func(c *fiber.Ctx) error {
			lang := legacyLang(c.Query("lang"))
			target := "/" + lang + "/news"
			if id := legacyID(c.Query("id")); id > 0 {
				var a models.Article
				if d.DB.Select("slug").Where("legacy_id = ? AND status = ?", id, models.StatusPublished).Limit(1).Find(&a).RowsAffected > 0 {
					target += "/" + a.Slug
				}
			}
			return c.Redirect(target, fiber.StatusMovedPermanently)
		})
	})
}

// legacyLang maps Joomla language values ("tk", "tk-TM", "ru-RU", ...) to a site locale.
func legacyLang(s string) string {
	s = strings.ToLower(s)
	switch {
	case strings.HasPrefix(s, "ru"):
		return "ru"
	case strings.HasPrefix(s, "en"):
		return "en"
	}
	return "tk"
}

// legacyID parses Joomla ids that may carry an alias suffix ("123-alias" or "123:alias").
func legacyID(s string) int {
	end := 0
	for end < len(s) && s[end] >= '0' && s[end] <= '9' {
		end++
	}
	id, _ := strconv.Atoi(s[:end])
	return id
}
