package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Language]{
			Entity:       "language",
			SearchFields: []string{"code", "name", "native_name"},
			SortFields:   []string{"id", "code", "name", "sort_order"},
			DefaultSort:  "sort_order",
			BeforeSave: func(c *fiber.Ctx, l *models.Language, isNew bool) error {
				l.Code = strings.ToLower(strings.TrimSpace(l.Code))
				if l.Code == "" {
					return errors.New("code is required")
				}
				if l.IsDefault {
					l.IsEnabled = true
				}
				return nil
			},
			AfterSave: func(c *fiber.Ctx, l *models.Language, isNew bool) error {
				if l.IsDefault {
					return d.DB.Model(&models.Language{}).Where("id <> ?", l.ID).Update("is_default", false).Error
				}
				return nil
			},
			BeforeDelete: func(c *fiber.Ctx, l *models.Language) error {
				if l.IsDefault {
					return errors.New("the default language cannot be deleted")
				}
				return nil
			},
		})
		g := d.AdminOnly.Group("/languages")
		crud.Register(g)
		g.Put("/:id/default", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			var l models.Language
			if err := d.DB.First(&l, id).Error; err != nil {
				return utils.NotFound(c, "")
			}
			err := d.DB.Transaction(func(tx *gorm.DB) error {
				if err := tx.Model(&models.Language{}).Where("1 = 1").Update("is_default", false).Error; err != nil {
					return err
				}
				return tx.Model(&l).Updates(map[string]any{"is_default": true, "is_enabled": true}).Error
			})
			if err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "update", "language", l.ID, fiber.Map{"default": true})
			d.DB.First(&l, id)
			return utils.OK(c, l)
		})

		d.Public.Get("/languages", func(c *fiber.Ctx) error {
			var list []models.Language
			d.DB.Where("is_enabled = ?", true).Order("sort_order ASC, id ASC").Find(&list)
			return utils.OK(c, list)
		})
	})
}
