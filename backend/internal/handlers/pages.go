package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Page]{
			Entity:       "page",
			SearchFields: []string{"title", "slug"},
			SortFields:   []string{"id", "created_at", "updated_at", "status", "slug"},
			DefaultSort:  "-updated_at",
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if s := c.Query("status"); s != "" {
					q = q.Where("status = ?", s)
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, p *models.Page, isNew bool) error {
				def := DefaultLocale(d.DB)
				if strings.TrimSpace(p.Title.Get(def, "")) == "" {
					return errors.New("title is required")
				}
				if p.Slug == "" {
					p.Slug = p.Title.Get(def, "")
				}
				p.Slug = utils.UniqueSlug(d.DB, "pages", p.Slug, p.ID)
				if p.Status == "" {
					p.Status = models.StatusDraft
				}
				if p.Template == "" {
					p.Template = "default"
				}
				if len(p.Blocks) == 0 {
					p.Blocks = models.JSON("[]")
				}
				if isNew {
					p.CreatedBy = middleware.CurrentUserID(c)
				}
				return nil
			},
			BeforeDelete: func(c *fiber.Ctx, p *models.Page) error {
				if p.IsSystem {
					return errors.New("system pages cannot be deleted")
				}
				return nil
			},
		})
		crud.Register(d.Admin.Group("/pages"))

		d.Public.Get("/pages/:slug", func(c *fiber.Ctx) error {
			var p models.Page
			if err := d.DB.Where("slug = ? AND status = ?", c.Params("slug"), models.StatusPublished).First(&p).Error; err != nil {
				return utils.NotFound(c, "Page not found")
			}
			return utils.OK(c, p)
		})
	})
}
