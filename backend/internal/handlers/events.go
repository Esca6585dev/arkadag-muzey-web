package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

const evEnd = "COALESCE(ends_at, starts_at)"

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Event]{
			Entity:       "event",
			SearchFields: []string{"title", "slug"},
			SortFields:   []string{"id", "starts_at", "created_at", "status"},
			DefaultSort:  "-starts_at",
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if s := c.Query("status"); s != "" {
					q = q.Where("status = ?", s)
				}
				if c.Query("upcoming") == "true" {
					q = q.Where(evEnd + " >= NOW()")
				}
				if c.Query("past") == "true" {
					q = q.Where(evEnd + " < NOW()")
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, m *models.Event, isNew bool) error {
				def := DefaultLocale(d.DB)
				if err := requireTitle(def, m.Title, "title"); err != nil {
					return err
				}
				if m.StartsAt.IsZero() {
					return errors.New("starts_at is required")
				}
				if m.Slug == "" {
					m.Slug = m.Title.Get(def, "")
				}
				m.Slug = utils.UniqueSlug(d.DB, "events", m.Slug, m.ID)
				if m.Status == "" {
					m.Status = models.StatusPublished
				}
				return nil
			},
		})
		crud.Register(d.Admin.Group("/events"))

		d.Public.Get("/events", func(c *fiber.Ctx) error {
			def := "-starts_at"
			q := d.DB.Model(&models.Event{}).Where("status = ?", models.StatusPublished)
			if c.Query("upcoming") == "true" {
				q = q.Where(evEnd + " >= NOW()")
				def = "starts_at"
			} else if c.Query("past") == "true" {
				q = q.Where(evEnd + " < NOW()")
			}
			p := utils.ParseList(c, def, []string{"starts_at", "created_at", "id"})
			q = filterByLocale(c, q, "title")
			q = utils.ApplySearch(q, p.Search, []string{"title", "summary", "slug"})
			var items []models.Event
			meta, err := utils.Paginate(q, p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.Event{}
			}
			return utils.Paginated(c, items, meta)
		})
		d.Public.Get("/events/:slug", func(c *fiber.Ctx) error {
			var e models.Event
			if err := d.DB.Where("slug = ? AND status = ?", c.Params("slug"), models.StatusPublished).First(&e).Error; err != nil {
				return utils.NotFound(c, "Event not found")
			}
			return utils.OK(c, e)
		})
	})
}
