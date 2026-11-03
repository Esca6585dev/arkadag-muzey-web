package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// TranslationsFor returns all UI string overrides for a locale (fallback default locale).
func TranslationsFor(db *gorm.DB, locale, def string) map[string]string {
	var all []models.Translation
	db.Find(&all)
	out := make(map[string]string, len(all))
	for _, tr := range all {
		if v := tr.Values.Get(locale, def); v != "" {
			out[tr.Key] = v
		}
	}
	return out
}

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Translation]{
			Entity:       "translation",
			SearchFields: []string{"key", "values"},
			SortFields:   []string{"id", "key", "group", "updated_at"},
			DefaultSort:  "key",
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if g := c.Query("group"); g != "" {
					q = q.Where("`group` = ?", g)
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, t *models.Translation, isNew bool) error {
				t.Key = strings.TrimSpace(t.Key)
				if t.Key == "" {
					return errors.New("key is required")
				}
				if t.Group == "" {
					t.Group = "common"
				}
				var n int64
				q := d.DB.Model(&models.Translation{}).Where("`key` = ?", t.Key)
				if t.ID > 0 {
					q = q.Where("id <> ?", t.ID)
				}
				q.Count(&n)
				if n > 0 {
					return errors.New("key already exists")
				}
				return nil
			},
		})
		g := d.Admin.Group("/translations")
		g.Get("/export", func(c *fiber.Ctx) error {
			locale := utils.Locale(c, DefaultLocale(d.DB))
			return utils.OK(c, TranslationsFor(d.DB, locale, DefaultLocale(d.DB)))
		})
		g.Post("/import", func(c *fiber.Ctx) error {
			var body struct {
				Entries map[string]models.Translatable `json:"entries"`
			}
			if err := c.BodyParser(&body); err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			group := c.Query("group", "common")
			upserted := 0
			err := d.DB.Transaction(func(tx *gorm.DB) error {
				for key, values := range body.Entries {
					key = strings.TrimSpace(key)
					if key == "" {
						continue
					}
					var t models.Translation
					if err := tx.Where("`key` = ?", key).First(&t).Error; err == nil {
						if t.Values == nil {
							t.Values = models.Translatable{}
						}
						for l, v := range values {
							t.Values[l] = v
						}
						if err := tx.Save(&t).Error; err != nil {
							return err
						}
					} else {
						if err := tx.Create(&models.Translation{Key: key, Values: values, Group: group}).Error; err != nil {
							return err
						}
					}
					upserted++
				}
				return nil
			})
			if err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "import", "translation", 0, fiber.Map{"count": upserted})
			return utils.OK(c, fiber.Map{"upserted": upserted})
		})
		crud.Register(g)
	})
}
