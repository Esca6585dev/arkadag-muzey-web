package handlers

import (
	"strings"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		d.Public.Get("/search", func(c *fiber.Ctx) error {
			q := strings.TrimSpace(c.Query("q"))
			if utf8.RuneCountInString(q) < 2 {
				return utils.BadRequest(c, "Query must be at least 2 characters")
			}
			like := "%" + strings.NewReplacer("%", "\\%", "_", "\\_").Replace(q) + "%"

			// run counts the full matches and loads the first 5 rows into dest.
			var total int64
			run := func(model any, cols []string, sel string, scope func(*gorm.DB) *gorm.DB, order string, dest any) error {
				parts := make([]string, len(cols))
				args := make([]any, len(cols))
				for i, col := range cols {
					parts[i] = "CAST(" + col + " AS CHAR) LIKE ?"
					args[i] = like
				}
				base := scope(d.DB.Model(model)).Where("("+strings.Join(parts, " OR ")+")", args...)
				var n int64
				if err := base.Session(&gorm.Session{}).Count(&n).Error; err != nil {
					return err
				}
				total += n
				return base.Session(&gorm.Session{}).Select(sel).Order(order).Limit(5).Find(dest).Error
			}

			var articles []models.Article
			var exhibits []models.Exhibit
			var halls []models.Hall
			var events []models.Event
			var pages []models.Page
			steps := []func() error{
				func() error {
					return run(&models.Article{}, []string{"title", "excerpt"}, "id, slug, title, excerpt, cover_image, published_at, category_id",
						func(t *gorm.DB) *gorm.DB { return t.Where("status = ?", models.StatusPublished) }, "published_at DESC, id DESC", &articles)
				},
				func() error {
					return run(&models.Exhibit{}, []string{"title", "summary"}, "id, slug, title, summary, image, hall_id",
						func(t *gorm.DB) *gorm.DB { return t.Where("status = ?", models.StatusPublished) }, "sort_order, id DESC", &exhibits)
				},
				func() error {
					return run(&models.Hall{}, []string{"name", "summary"}, "id, slug, name, summary, cover_image",
						func(t *gorm.DB) *gorm.DB { return t.Where("is_active = ?", true) }, "sort_order, id", &halls)
				},
				func() error {
					return run(&models.Event{}, []string{"title", "summary"}, "id, slug, title, summary, image, starts_at, ends_at",
						func(t *gorm.DB) *gorm.DB { return t.Where("status = ?", models.StatusPublished) }, "starts_at DESC", &events)
				},
				func() error {
					return run(&models.Page{}, []string{"title", "excerpt"}, "id, slug, title, excerpt, cover_image",
						func(t *gorm.DB) *gorm.DB { return t.Where("status = ?", models.StatusPublished) }, "id DESC", &pages)
				},
			}
			for _, s := range steps {
				if err := s(); err != nil {
					return utils.ServerError(c, err)
				}
			}
			if articles == nil {
				articles = []models.Article{}
			}
			if exhibits == nil {
				exhibits = []models.Exhibit{}
			}
			if halls == nil {
				halls = []models.Hall{}
			}
			if events == nil {
				events = []models.Event{}
			}
			if pages == nil {
				pages = []models.Page{}
			}
			return c.JSON(fiber.Map{"data": fiber.Map{
				"articles": articles, "exhibits": exhibits, "halls": halls, "events": events, "pages": pages, "total": total,
			}})
		})
	})
}
