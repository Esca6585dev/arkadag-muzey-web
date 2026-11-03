package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		// GET /public/bootstrap?locale= — everything the site layout needs in one call.
		d.Public.Get("/bootstrap", func(c *fiber.Ctx) error {
			def := DefaultLocale(d.DB)
			locale := utils.Locale(c, def)

			var languages []models.Language
			d.DB.Where("is_enabled = ?", true).Order("sort_order ASC, id ASC").Find(&languages)

			var menus []models.Menu
			d.DB.Find(&menus)
			menuMap := make(map[string][]models.MenuItem, len(menus))
			for _, m := range menus {
				menuMap[m.Slug] = MenuTree(d.DB, m.ID, true)
			}

			return utils.OK(c, fiber.Map{
				"locale":         locale,
				"default_locale": def,
				"settings":       PublicSettingsMap(d.DB),
				"languages":      languages,
				"menus":          menuMap,
				"translations":   TranslationsFor(d.DB, locale, def),
			})
		})
	})
}
