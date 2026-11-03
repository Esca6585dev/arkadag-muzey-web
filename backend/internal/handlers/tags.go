package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Tag]{
			Entity:       "tag",
			SearchFields: []string{"name", "slug"},
			SortFields:   []string{"id", "created_at", "slug"},
			DefaultSort:  "-id",
			BeforeSave: func(c *fiber.Ctx, m *models.Tag, isNew bool) error {
				def := DefaultLocale(d.DB)
				if err := requireTitle(def, m.Name, "name"); err != nil {
					return err
				}
				if m.Slug == "" {
					m.Slug = m.Name.Get(def, "")
				}
				m.Slug = utils.UniqueSlug(d.DB, "tags", m.Slug, m.ID)
				return nil
			},
		})
		crud.Register(d.Admin.Group("/tags"))
	})
}
