package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		d.Public.Get("/stats", func(c *fiber.Ctx) error {
			var ex, ha, ar, ev, ga int64
			pub := models.StatusPublished
			d.DB.Model(&models.Exhibit{}).Where("status = ?", pub).Count(&ex)
			d.DB.Model(&models.Hall{}).Where("is_active = ?", true).Count(&ha)
			d.DB.Model(&models.Article{}).Where("status = ? AND (published_at IS NULL OR published_at <= ?)", pub, time.Now()).Count(&ar)
			d.DB.Model(&models.Event{}).Where("status = ?", pub).Count(&ev)
			d.DB.Model(&models.Gallery{}).Where("is_active = ?", true).Count(&ga)
			return utils.OK(c, fiber.Map{"exhibits": ex, "halls": ha, "articles": ar, "events": ev, "galleries": ga})
		})
	})
}
