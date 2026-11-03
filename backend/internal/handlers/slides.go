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
		crud := NewCrud(d.DB, CrudConfig[models.Slide]{
			Entity:       "slide",
			SearchFields: []string{"title", "subtitle"},
			SortFields:   []string{"id", "created_at", "sort_order", "position"},
			DefaultSort:  "sort_order",
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if v := c.Query("position"); v != "" {
					q = q.Where("position = ?", v)
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, m *models.Slide, isNew bool) error {
				if m.Image == "" {
					return errors.New("image is required")
				}
				if m.Position == "" {
					m.Position = "home"
				}
				return nil
			},
		})
		crud.Register(d.Admin.Group("/slides"))

		d.Public.Get("/slides", func(c *fiber.Ctx) error {
			var items []models.Slide
			q := d.DB.Where("is_active = ?", true)
			if v := c.Query("position"); v != "" {
				q = q.Where("position = ?", v)
			}
			if err := q.Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.Slide{}
			}
			return utils.OK(c, items)
		})
	})
}
