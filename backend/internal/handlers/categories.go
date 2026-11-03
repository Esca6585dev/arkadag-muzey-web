package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Category]{
			Entity:       "category",
			SearchFields: []string{"name", "slug"},
			SortFields:   []string{"id", "created_at", "sort_order", "slug"},
			DefaultSort:  "sort_order",
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if v := c.QueryInt("parent_id"); v > 0 {
					q = q.Where("parent_id = ?", v)
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, m *models.Category, isNew bool) error {
				def := DefaultLocale(d.DB)
				if err := requireTitle(def, m.Name, "name"); err != nil {
					return err
				}
				if m.Slug == "" {
					m.Slug = m.Name.Get(def, "")
				}
				m.Slug = utils.UniqueSlug(d.DB, "categories", m.Slug, m.ID)
				return nil
			},
			BeforeDelete: func(c *fiber.Ctx, m *models.Category) error {
				var n int64
				d.DB.Model(&models.Article{}).Where("category_id = ?", m.ID).Count(&n)
				if n > 0 {
					return errors.New("category has articles")
				}
				return nil
			},
		})
		g := d.Admin.Group("/categories")
		g.Get("/", listFilled(crud, func(items []models.Category) {
			ids := make([]uint, len(items))
			for i, it := range items {
				ids[i] = it.ID
			}
			m := countBy(d.DB, "articles", "category_id", ids, "")
			for i := range items {
				items[i].ArticleCount = m[items[i].ID]
			}
		}))
		crud.Register(g)

		d.Public.Get("/categories", func(c *fiber.Ctx) error {
			var items []models.Category
			if err := d.DB.Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
				return utils.ServerError(c, err)
			}
			if len(items) > 0 {
				ids := make([]uint, len(items))
				for i, it := range items {
					ids[i] = it.ID
				}
				m := countBy(d.DB, "articles", "category_id", ids, "status = ?", models.StatusPublished)
				for i := range items {
					items[i].ArticleCount = m[items[i].ID]
				}
			}
			if items == nil {
				items = []models.Category{}
			}
			return utils.OK(c, items)
		})
	})
}
