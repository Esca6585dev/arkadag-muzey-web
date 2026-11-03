package handlers

import (
	"errors"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// contactLimiter is an in-memory per-IP sliding-window limiter for the contact form.
type contactLimiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
	last time.Time
}

func (l *contactLimiter) allow(ip string, max int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if now.Sub(l.last) > time.Minute { // periodic cleanup
		for k, v := range l.hits {
			if len(v) == 0 || now.Sub(v[len(v)-1]) > window {
				delete(l.hits, k)
			}
		}
		l.last = now
	}
	recent := make([]time.Time, 0, len(l.hits[ip])+1)
	for _, t := range l.hits[ip] {
		if now.Sub(t) < window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= max {
		l.hits[ip] = recent
		return false
	}
	l.hits[ip] = append(recent, now)
	return true
}

func init() {
	Register(func(d *Deps) {
		lim := &contactLimiter{hits: map[string][]time.Time{}, last: time.Now()}

		d.Public.Post("/contact", func(c *fiber.Ctx) error {
			if !lim.allow(utils.ClientIP(c), 5, 10*time.Minute) {
				return utils.Error(c, fiber.StatusTooManyRequests, "rate_limited", "Too many messages, please try again later")
			}
			var in models.ContactMessage
			if err := c.BodyParser(&in); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			if f := utils.Validate(&in); len(f) > 0 {
				return utils.ValidationError(c, f)
			}
			m := models.ContactMessage{
				Name: in.Name, Email: in.Email, Phone: in.Phone, Subject: in.Subject, Message: in.Message,
				Status: "new", IP: utils.ClientIP(c), Locale: utils.Locale(c, DefaultLocale(d.DB)),
				UserID: middleware.CurrentUserID(c),
			}
			if err := d.DB.Create(&m).Error; err != nil {
				return utils.ServerError(c, err)
			}
			return utils.Created(c, fiber.Map{"id": m.ID, "message": "Message sent"})
		})

		// ----- admin -----
		crud := NewCrud(d.DB, CrudConfig[models.ContactMessage]{
			Entity:       "message",
			SearchFields: []string{"name", "email", "subject", "message"},
			SortFields:   []string{"id", "created_at", "status", "name", "email"},
			DefaultSort:  "-created_at",
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if s := c.Query("status"); s != "" {
					q = q.Where("status = ?", s)
				}
				return q
			},
		})
		r := d.Admin.Group("/messages")
		r.Get("/", crud.List)
		r.Post("/bulk-delete", crud.BulkDelete)
		r.Get("/unread-count", func(c *fiber.Ctx) error {
			var n int64
			d.DB.Model(&models.ContactMessage{}).Where("status = ?", "new").Count(&n)
			return utils.OK(c, fiber.Map{"count": n})
		})
		r.Get("/:id", func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var m models.ContactMessage
			if err := d.DB.First(&m, id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return utils.NotFound(c, "")
				}
				return utils.ServerError(c, err)
			}
			if m.Status == "new" {
				m.Status = "read"
				d.DB.Model(&m).UpdateColumn("status", "read")
			}
			return utils.OK(c, m)
		})
		r.Put("/:id", crud.Update)
		r.Patch("/:id", crud.Update)
		r.Delete("/:id", crud.Delete)

		// ----- user -----
		d.User.Get("/messages", func(c *fiber.Ctx) error {
			u := middleware.CurrentUser(c)
			p := utils.ParseList(c, "-created_at", []string{"id", "created_at", "status"})
			q := d.DB.Model(&models.ContactMessage{}).Where("(user_id = ? OR email = ?)", u.ID, u.Email)
			var items []models.ContactMessage
			meta, err := utils.Paginate(q, p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			if items == nil {
				items = []models.ContactMessage{}
			}
			return utils.Paginated(c, items, meta)
		})
	})
}
