package handlers

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

func itemsOrdered(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") }

func galleryExists(db *gorm.DB, id int) bool {
	var n int64
	db.Model(&models.Gallery{}).Where("id = ?", id).Count(&n)
	return n > 0
}

func nextItemOrder(db *gorm.DB, gid int) int {
	var max *int
	db.Model(&models.GalleryItem{}).Where("gallery_id = ?", gid).Select("MAX(sort_order)").Scan(&max)
	if max == nil {
		return 0
	}
	return *max + 1
}

func gcount(db *gorm.DB, items []models.Gallery) {
	if len(items) == 0 {
		return
	}
	ids := make([]uint, len(items))
	for i, it := range items {
		ids[i] = it.ID
	}
	m := countBy(db, "gallery_items", "gallery_id", ids, "")
	for i := range items {
		items[i].ItemCount = m[items[i].ID]
	}
}

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Gallery]{
			Entity:       "gallery",
			SearchFields: []string{"title", "slug"},
			SortFields:   []string{"id", "created_at", "sort_order", "slug"},
			DefaultSort:  "sort_order",
			Preloads:     []string{"Items"},
			BeforeSave: func(c *fiber.Ctx, m *models.Gallery, isNew bool) error {
				def := DefaultLocale(d.DB)
				if err := requireTitle(def, m.Title, "title"); err != nil {
					return err
				}
				if m.Slug == "" {
					m.Slug = m.Title.Get(def, "")
				}
				m.Slug = utils.UniqueSlug(d.DB, "galleries", m.Slug, m.ID)
				m.Items = nil
				return nil
			},
		})
		// list without preloading items, only counts
		listCrud := NewCrud(d.DB, crud.Cfg)
		listCrud.Cfg.Preloads = nil

		g := d.Admin.Group("/galleries")
		g.Get("/", listFilled(listCrud, func(items []models.Gallery) { gcount(d.DB, items) }))
		g.Get("/:id", func(c *fiber.Ctx) error {
			id, err := c.ParamsInt("id")
			if err != nil || id <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var gl models.Gallery
			if err := d.DB.Preload("Items", itemsOrdered).First(&gl, id).Error; err != nil {
				return utils.NotFound(c, "")
			}
			return utils.OK(c, gl)
		})

		g.Post("/:id/items", func(c *fiber.Ctx) error {
			gid, err := c.ParamsInt("id")
			if err != nil || gid <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var in models.GalleryItem
			if err := c.BodyParser(&in); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			if in.Image == "" {
				return utils.ValidationError(c, map[string]string{"image": "image is required"})
			}
			if !galleryExists(d.DB, gid) {
				return utils.NotFound(c, "Gallery not found")
			}
			in.ID, in.GalleryID = 0, uint(gid)
			in.SortOrder = nextItemOrder(d.DB, gid)
			if err := d.DB.Create(&in).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "create", "gallery_item", in.ID, nil)
			return utils.Created(c, in)
		})
		g.Post("/:id/items/bulk", func(c *fiber.Ctx) error {
			gid, err := c.ParamsInt("id")
			if err != nil || gid <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			var body struct {
				Images []string `json:"images"`
			}
			if err := c.BodyParser(&body); err != nil || len(body.Images) == 0 {
				return utils.BadRequest(c, "images is required")
			}
			if !galleryExists(d.DB, gid) {
				return utils.NotFound(c, "Gallery not found")
			}
			order := nextItemOrder(d.DB, gid)
			items := make([]models.GalleryItem, 0, len(body.Images))
			for _, img := range body.Images {
				if img == "" {
					continue
				}
				items = append(items, models.GalleryItem{GalleryID: uint(gid), Image: img, SortOrder: order})
				order++
			}
			if len(items) == 0 {
				return utils.BadRequest(c, "images is required")
			}
			if err := d.DB.Create(&items).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "create", "gallery_item", uint(gid), fiber.Map{"count": len(items)})
			return utils.Created(c, items)
		})
		g.Post("/:id/items/reorder", func(c *fiber.Ctx) error {
			gid, err := c.ParamsInt("id")
			if err != nil || gid <= 0 {
				return utils.BadRequest(c, "Invalid id")
			}
			ids, err := utils.ParseIDs(c)
			if err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			err = d.DB.Transaction(func(tx *gorm.DB) error {
				for i, id := range ids {
					if err := tx.Model(&models.GalleryItem{}).Where("id = ? AND gallery_id = ?", id, gid).Update("sort_order", i).Error; err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				return utils.ServerError(c, err)
			}
			return utils.Message(c, "Reordered")
		})
		g.Put("/:id/items/:itemId", func(c *fiber.Ctx) error {
			gid, e1 := c.ParamsInt("id")
			iid, e2 := c.ParamsInt("itemId")
			if e1 != nil || e2 != nil {
				return utils.BadRequest(c, "Invalid id")
			}
			var it models.GalleryItem
			if err := d.DB.Where("id = ? AND gallery_id = ?", iid, gid).First(&it).Error; err != nil {
				return utils.NotFound(c, "Item not found")
			}
			if err := c.BodyParser(&it); err != nil {
				return utils.BadRequest(c, "Invalid JSON body")
			}
			it.ID, it.GalleryID = uint(iid), uint(gid)
			if it.Image == "" {
				return utils.ValidationError(c, map[string]string{"image": "image is required"})
			}
			if err := d.DB.Save(&it).Error; err != nil {
				return utils.ServerError(c, err)
			}
			return utils.OK(c, it)
		})
		g.Delete("/:id/items/:itemId", func(c *fiber.Ctx) error {
			gid, e1 := c.ParamsInt("id")
			iid, e2 := c.ParamsInt("itemId")
			if e1 != nil || e2 != nil {
				return utils.BadRequest(c, "Invalid id")
			}
			res := d.DB.Where("id = ? AND gallery_id = ?", iid, gid).Delete(&models.GalleryItem{})
			if res.Error != nil {
				return utils.ServerError(c, res.Error)
			}
			if res.RowsAffected == 0 {
				return utils.NotFound(c, "Item not found")
			}
			LogActivity(c, d.DB, "delete", "gallery_item", uint(iid), nil)
			return utils.Message(c, "Deleted")
		})
		crud.Register(g) // remaining standard routes (GET /, /:id above take precedence)

		d.Public.Get("/galleries", func(c *fiber.Ctx) error {
			var items []models.Gallery
			q := filterByLocale(c, d.DB.Where("is_active = ?", true), "title")
			if err := q.Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
				return utils.ServerError(c, err)
			}
			gcount(d.DB, items)
			if items == nil {
				items = []models.Gallery{}
			}
			return utils.OK(c, items)
		})
		d.Public.Get("/galleries/:slug", func(c *fiber.Ctx) error {
			var gl models.Gallery
			if err := d.DB.Preload("Items", itemsOrdered).Where("slug = ? AND is_active = ?", c.Params("slug"), true).First(&gl).Error; err != nil {
				return utils.NotFound(c, "Gallery not found")
			}
			return utils.OK(c, gl)
		})
	})
}
