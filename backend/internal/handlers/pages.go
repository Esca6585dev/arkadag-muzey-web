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

// routePages are pages with their own frontend routes; their slug must not change.
var routePages = map[string]bool{"home": true, "about": true, "contact": true, "visit": true}

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
				// is_system is never taken from the request; system pages keep their slug because
				// routes such as / and /about depend on it.
				p.IsSystem = false
				if !isNew {
					var orig models.Page
					if err := d.DB.Select("slug", "is_system").First(&orig, p.ID).Error; err == nil && (orig.IsSystem || routePages[orig.Slug]) {
						p.IsSystem = true
						p.Slug = orig.Slug
					}
				}
				if p.Slug == "" {
					p.Slug = p.Title.Get(def, "")
				}
				if !p.IsSystem {
					p.Slug = utils.UniqueSlug(d.DB, "pages", p.Slug, p.ID)
				}
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
				if p.IsSystem || routePages[p.Slug] {
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
