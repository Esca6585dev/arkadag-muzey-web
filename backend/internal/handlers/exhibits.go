package handlers

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Exhibit]{
			Entity:       "exhibit",
			SearchFields: []string{"title", "slug", "inventory_no"},
			SortFields:   []string{"id", "created_at", "sort_order", "views", "status"},
			DefaultSort:  "-id",
			Preloads:     []string{"Hall"},
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if v := c.QueryInt("hall_id"); v > 0 {
					q = q.Where("hall_id = ?", v)
				}
				if s := c.Query("status"); s != "" {
					q = q.Where("status = ?", s)
				}
				if c.Query("featured") == "true" {
					q = q.Where("is_featured = ?", true)
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, m *models.Exhibit, isNew bool) error {
				def := DefaultLocale(d.DB)
				if err := requireTitle(def, m.Title, "title"); err != nil {
					return err
				}
				if m.Slug == "" {
					m.Slug = m.Title.Get(def, "")
				}
				m.Slug = utils.UniqueSlug(d.DB, "exhibits", m.Slug, m.ID)
				if m.Status == "" {
					m.Status = models.StatusPublished
				}
				m.Hall = nil
				return nil
			},
		})
		crud.Register(d.Admin.Group("/exhibits"))

		d.Public.Get("/exhibits", func(c *fiber.Ctx) error {
			p := utils.ParseList(c, "sort_order", []string{"sort_order", "created_at", "views", "id"})
			q := d.DB.Model(&models.Exhibit{}).Preload("Hall").Where("exhibits.status = ?", models.StatusPublished)
			q = utils.ApplySearch(q, p.Search, []string{"exhibits.title", "exhibits.summary"})
			if h := c.Query("hall"); h != "" {
				q = q.Joins("JOIN halls ON halls.id = exhibits.hall_id AND halls.slug = ?", h)
			}
			if c.Query("featured") == "true" {
				q = q.Where("exhibits.is_featured = ?", true)
			}
			if p.Sort != "" {
				p.Sort = "exhibits." + p.Sort
			}
			var items []models.Exhibit
			meta, err := utils.Paginate(q, p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.Exhibit{}
			}
			return utils.Paginated(c, items, meta)
		})

		d.Public.Get("/exhibits/:slug", func(c *fiber.Ctx) error {
			var e models.Exhibit
			if err := d.DB.Preload("Hall").Where("slug = ? AND status = ?", c.Params("slug"), models.StatusPublished).First(&e).Error; err != nil {
				return utils.NotFound(c, "Exhibit not found")
			}
			d.DB.Model(&e).UpdateColumn("views", gorm.Expr("views + 1"))
			related := []models.Exhibit{}
			if e.HallID != nil {
				d.DB.Where("hall_id = ? AND id <> ? AND status = ?", *e.HallID, e.ID, models.StatusPublished).
					Order("sort_order ASC, id ASC").Limit(6).Find(&related)
			}
			return utils.OK(c, fiber.Map{"exhibit": e, "related": related})
		})
	})
}
