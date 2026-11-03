package handlers

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Hall]{
			Entity:       "hall",
			SearchFields: []string{"name", "slug"},
			SortFields:   []string{"id", "created_at", "sort_order", "slug"},
			DefaultSort:  "sort_order",
			BeforeSave: func(c *fiber.Ctx, m *models.Hall, isNew bool) error {
				def := DefaultLocale(d.DB)
				if err := requireTitle(def, m.Name, "name"); err != nil {
					return err
				}
				if m.Slug == "" {
					m.Slug = m.Name.Get(def, "")
				}
				m.Slug = utils.UniqueSlug(d.DB, "halls", m.Slug, m.ID)
				return nil
			},
			BeforeDelete: func(c *fiber.Ctx, m *models.Hall) error {
				return d.DB.Model(&models.Exhibit{}).Where("hall_id = ?", m.ID).Update("hall_id", nil).Error
			},
		})
		g := d.Admin.Group("/halls")
		g.Get("/", listFilled(crud, func(items []models.Hall) {
			ids := make([]uint, len(items))
			for i, it := range items {
				ids[i] = it.ID
			}
			m := countBy(d.DB, "exhibits", "hall_id", ids, "")
			for i := range items {
				items[i].ExhibitCount = m[items[i].ID]
			}
		}))
		crud.Register(g)

		d.Public.Get("/halls", func(c *fiber.Ctx) error {
			var items []models.Hall
			if err := d.DB.Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
				return utils.ServerError(c, err)
			}
			if len(items) > 0 {
				ids := make([]uint, len(items))
				for i, it := range items {
					ids[i] = it.ID
				}
				m := countBy(d.DB, "exhibits", "hall_id", ids, "status = ?", models.StatusPublished)
				for i := range items {
					items[i].ExhibitCount = m[items[i].ID]
				}
			}
			if items == nil {
				items = []models.Hall{}
			}
			return utils.OK(c, items)
		})
		d.Public.Get("/halls/:slug", func(c *fiber.Ctx) error {
			var h models.Hall
			err := d.DB.Preload("Exhibits", func(db *gorm.DB) *gorm.DB {
				return db.Where("status = ?", models.StatusPublished).Order("sort_order ASC, id ASC")
			}).
				Where("slug = ? AND is_active = ?", c.Params("slug"), true).First(&h).Error
			if err != nil {
				return utils.NotFound(c, "Hall not found")
			}
			return utils.OK(c, h)
		})
	})
}
