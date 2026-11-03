package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		d.AdminOnly.Get("/activity-logs", func(c *fiber.Ctx) error {
			p := utils.ParseList(c, "-created_at", []string{"id", "created_at", "action", "entity", "user_id"})
			q := d.DB.Model(&models.ActivityLog{}).Preload("User")
			if v := c.Query("entity"); v != "" {
				q = q.Where("entity = ?", v)
			}
			if v := c.Query("action"); v != "" {
				q = q.Where("action = ?", v)
			}
			if v := c.QueryInt("user_id"); v > 0 {
				q = q.Where("user_id = ?", v)
			}
			var items []models.ActivityLog
			meta, err := utils.Paginate(q, p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.ActivityLog{}
			}
			return utils.Paginated(c, items, meta)
		})
	})
}
