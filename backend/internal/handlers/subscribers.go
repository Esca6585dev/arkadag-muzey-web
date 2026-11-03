package handlers

import (
	"encoding/csv"
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		d.Public.Post("/subscribe", func(c *fiber.Ctx) error {
			var in struct {
				Email  string `json:"email" validate:"required,email"`
				Name   string `json:"name"`
				Locale string `json:"locale"`
			}
			if err := c.BodyParser(&in); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			if f := utils.Validate(&in); len(f) > 0 {
				return utils.ValidationError(c, f)
			}
			if in.Locale == "" {
				in.Locale = utils.Locale(c, DefaultLocale(d.DB))
			}
			var s models.Subscriber
			err := d.DB.Where("email = ?", in.Email).First(&s).Error
			if err == nil {
				s.UnsubscribedAt = nil
				s.IsConfirmed = true
				if s.Token == "" {
					s.Token = utils.RandomToken(16)
				}
				if err := d.DB.Save(&s).Error; err != nil {
					return utils.ServerError(c, err)
				}
				return utils.Message(c, "You are subscribed")
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.ServerError(c, err)
			}
			s = models.Subscriber{Email: in.Email, Name: in.Name, Locale: in.Locale, IsConfirmed: true, Token: utils.RandomToken(16)}
			if err := d.DB.Create(&s).Error; err != nil {
				return utils.ServerError(c, err)
			}
			return utils.Created(c, fiber.Map{"message": "You are subscribed"})
		})

		d.Public.Get("/unsubscribe", func(c *fiber.Ctx) error {
			tok := c.Query("token")
			if tok == "" {
				return utils.BadRequest(c, "token is required")
			}
			res := d.DB.Model(&models.Subscriber{}).Where("token = ?", tok).Update("unsubscribed_at", time.Now())
			if res.Error != nil {
				return utils.ServerError(c, res.Error)
			}
			if res.RowsAffected == 0 {
				return utils.NotFound(c, "Subscription not found")
			}
			return utils.Message(c, "You have been unsubscribed")
		})

		filter := func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
			switch c.Query("confirmed") {
			case "true":
				q = q.Where("is_confirmed = ?", true)
			case "false":
				q = q.Where("is_confirmed = ?", false)
			}
			if c.Query("active") == "true" {
				q = q.Where("unsubscribed_at IS NULL")
			}
			return q
		}
		crud := NewCrud(d.DB, CrudConfig[models.Subscriber]{
			Entity:       "subscriber",
			SearchFields: []string{"email", "name"},
			SortFields:   []string{"id", "created_at", "email", "name"},
			DefaultSort:  "-created_at",
			Filters:      filter,
		})
		r := d.Admin.Group("/subscribers")
		r.Get("/", crud.List)
		r.Post("/bulk-delete", crud.BulkDelete)
		r.Get("/export.csv", func(c *fiber.Ctx) error {
			var items []models.Subscriber
			if err := filter(c, d.DB.Model(&models.Subscriber{})).Order("id").Find(&items).Error; err != nil {
				return utils.ServerError(c, err)
			}
			c.Set("Content-Type", "text/csv; charset=utf-8")
			c.Set("Content-Disposition", "attachment; filename=\"subscribers.csv\"")
			w := csv.NewWriter(c.Response().BodyWriter())
			_ = w.Write([]string{"email", "name", "locale", "created_at"})
			for _, s := range items {
				_ = w.Write([]string{s.Email, s.Name, s.Locale, s.CreatedAt.UTC().Format(time.RFC3339)})
			}
			w.Flush()
			return nil
		})
		r.Get("/:id", crud.Get)
		r.Delete("/:id", crud.Delete)
	})
}
