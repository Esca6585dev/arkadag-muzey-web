package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// monthlyCounts returns the last 12 months (oldest first) of row counts grouped by created_at.
func monthlyCounts(db *gorm.DB, model any) []fiber.Map {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -11, 0)
	var rows []struct {
		Month string
		Count int64
	}
	db.Model(model).Select("DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count").
		Where("created_at >= ?", start).Group("month").Order("month").Scan(&rows)
	have := map[string]int64{}
	for _, r := range rows {
		have[r.Month] = r.Count
	}
	out := make([]fiber.Map, 0, 12)
	for i := 0; i < 12; i++ {
		m := start.AddDate(0, i, 0).Format("2006-01")
		out = append(out, fiber.Map{"month": m, "count": have[m]})
	}
	return out
}

func init() {
	Register(func(d *Deps) {
		d.Admin.Get("/dashboard", func(c *fiber.Ctx) error {
			count := func(model any, where ...any) int64 {
				var n int64
				q := d.DB.Model(model)
				if len(where) > 0 {
					q = q.Where(where[0], where[1:]...)
				}
				q.Count(&n)
				return n
			}
			sumViews := func(model any) int64 {
				var n int64
				d.DB.Model(model).Select("COALESCE(SUM(views),0)").Scan(&n)
				return n
			}

			var top []struct {
				ID    uint                `json:"id"`
				Title models.Translatable `json:"title"`
				Views int64               `json:"views"`
			}
			d.DB.Model(&models.Article{}).Select("id, title, views").Order("views DESC, id DESC").Limit(10).Scan(&top)
			topOut := make([]fiber.Map, 0, len(top))
			for _, t := range top {
				topOut = append(topOut, fiber.Map{"id": t.ID, "title": t.Title, "views": t.Views})
			}

			var arts []models.Article
			d.DB.Omit("body").Preload("Category").Order("created_at DESC").Limit(5).Find(&arts)
			var msgs []models.ContactMessage
			d.DB.Order("created_at DESC").Limit(5).Find(&msgs)
			var logs []models.ActivityLog
			d.DB.Preload("User").Order("created_at DESC, id DESC").Limit(10).Find(&logs)
			if arts == nil {
				arts = []models.Article{}
			}
			if msgs == nil {
				msgs = []models.ContactMessage{}
			}
			if logs == nil {
				logs = []models.ActivityLog{}
			}

			return utils.OK(c, fiber.Map{
				"counts": fiber.Map{
					"articles":           count(&models.Article{}),
					"published_articles": count(&models.Article{}, "status = ?", models.StatusPublished),
					"exhibits":           count(&models.Exhibit{}),
					"halls":              count(&models.Hall{}),
					"galleries":          count(&models.Gallery{}),
					"events":             count(&models.Event{}),
					"users":              count(&models.User{}),
					"messages_new":       count(&models.ContactMessage{}, "status = ?", "new"),
					"subscribers":        count(&models.Subscriber{}),
					"media":              count(&models.Media{}),
				},
				"views": fiber.Map{"articles": sumViews(&models.Article{}), "exhibits": sumViews(&models.Exhibit{})},
				"charts": fiber.Map{
					"articles_by_month": monthlyCounts(d.DB, &models.Article{}),
					"top_articles":      topOut,
					"messages_by_month": monthlyCounts(d.DB, &models.ContactMessage{}),
				},
				"recent": fiber.Map{"articles": arts, "messages": msgs, "logs": logs},
			})
		})
	})
}
