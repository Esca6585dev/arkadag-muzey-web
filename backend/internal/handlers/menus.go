package handlers

import (
	"sort"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// BuildMenuTree nests flat items by parent_id, sorted by sort_order.
func BuildMenuTree(items []models.MenuItem) []models.MenuItem {
	byParent := map[uint][]models.MenuItem{}
	for _, it := range items {
		pid := uint(0)
		if it.ParentID != nil {
			pid = *it.ParentID
		}
		byParent[pid] = append(byParent[pid], it)
	}
	var build func(pid uint) []models.MenuItem
	build = func(pid uint) []models.MenuItem {
		list := byParent[pid]
		sort.SliceStable(list, func(i, j int) bool { return list[i].SortOrder < list[j].SortOrder })
		out := make([]models.MenuItem, 0, len(list))
		for _, it := range list {
			it.Children = build(it.ID)
			out = append(out, it)
		}
		return out
	}
	return build(0)
}

// MenuTree loads a menu's items (optionally only active) as a tree.
func MenuTree(db *gorm.DB, menuID uint, activeOnly bool) []models.MenuItem {
	var items []models.MenuItem
	q := db.Where("menu_id = ?", menuID)
	if activeOnly {
		q = q.Where("is_active = ?", true)
	}
	q.Order("sort_order ASC, id ASC").Find(&items)
	return BuildMenuTree(items)
}

type treeNode struct {
	ID       uint       `json:"id"`
	Children []treeNode `json:"children"`
}

func init() {
	Register(func(d *Deps) {
		crud := NewCrud(d.DB, CrudConfig[models.Menu]{
			Entity:       "menu",
			SearchFields: []string{"name", "slug"},
			SortFields:   []string{"id", "name", "slug"},
			DefaultSort:  "id",
			BeforeSave: func(c *fiber.Ctx, m *models.Menu, isNew bool) error {
				m.Slug = utils.UniqueSlug(d.DB, "menus", firstNonEmpty(m.Slug, m.Name), m.ID)
				return nil
			},
		})
		g := d.Admin.Group("/menus")
		g.Get("/", crud.List)
		g.Post("/", crud.Create)
		g.Post("/bulk-delete", crud.BulkDelete)
		g.Get("/:id", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			var m models.Menu
			if err := d.DB.First(&m, id).Error; err != nil {
				return utils.NotFound(c, "")
			}
			m.Items = MenuTree(d.DB, m.ID, false)
			return utils.OK(c, m)
		})
		g.Put("/:id", crud.Update)
		g.Patch("/:id", crud.Update)
		g.Delete("/:id", crud.Delete)

		// items
		g.Post("/:id/items", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			var m models.Menu
			if err := d.DB.First(&m, id).Error; err != nil {
				return utils.NotFound(c, "Menu not found")
			}
			var it models.MenuItem
			if err := c.BodyParser(&it); err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			it.ID = 0
			it.MenuID = m.ID
			if it.Type == "" {
				it.Type = "link"
			}
			if it.Target == "" {
				it.Target = "_self"
			}
			var max int
			d.DB.Model(&models.MenuItem{}).Where("menu_id = ?", m.ID).Select("COALESCE(MAX(sort_order),-1)").Scan(&max)
			it.SortOrder = max + 1
			if err := d.DB.Create(&it).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "create", "menu_item", it.ID, nil)
			return utils.Created(c, it)
		})
		g.Put("/:id/items/:itemId", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			itemID, _ := c.ParamsInt("itemId")
			var it models.MenuItem
			if err := d.DB.Where("menu_id = ?", id).First(&it, itemID).Error; err != nil {
				return utils.NotFound(c, "Item not found")
			}
			if err := c.BodyParser(&it); err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			it.ID = uint(itemID)
			it.MenuID = uint(id)
			if err := d.DB.Save(&it).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "update", "menu_item", it.ID, nil)
			return utils.OK(c, it)
		})
		g.Delete("/:id/items/:itemId", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			itemID, _ := c.ParamsInt("itemId")
			var it models.MenuItem
			if err := d.DB.Where("menu_id = ?", id).First(&it, itemID).Error; err != nil {
				return utils.NotFound(c, "Item not found")
			}
			ids := []uint{it.ID}
			frontier := []uint{it.ID}
			for len(frontier) > 0 {
				var children []uint
				d.DB.Model(&models.MenuItem{}).Where("parent_id IN ?", frontier).Pluck("id", &children)
				ids = append(ids, children...)
				frontier = children
			}
			if err := d.DB.Delete(&models.MenuItem{}, ids).Error; err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "delete", "menu_item", it.ID, fiber.Map{"deleted": len(ids)})
			return utils.Message(c, "Deleted")
		})
		g.Put("/:id/tree", func(c *fiber.Ctx) error {
			id, _ := c.ParamsInt("id")
			var body struct {
				Items []treeNode `json:"items"`
			}
			if err := c.BodyParser(&body); err != nil {
				return utils.BadRequest(c, "Invalid body")
			}
			err := d.DB.Transaction(func(tx *gorm.DB) error {
				var walk func(nodes []treeNode, parent *uint) error
				walk = func(nodes []treeNode, parent *uint) error {
					for i, n := range nodes {
						if err := tx.Model(&models.MenuItem{}).Where("id = ? AND menu_id = ?", n.ID, id).
							Updates(map[string]any{"parent_id": parent, "sort_order": i}).Error; err != nil {
							return err
						}
						nid := n.ID
						if err := walk(n.Children, &nid); err != nil {
							return err
						}
					}
					return nil
				}
				return walk(body.Items, nil)
			})
			if err != nil {
				return utils.ServerError(c, err)
			}
			LogActivity(c, d.DB, "update", "menu", uint(id), fiber.Map{"tree": true})
			return utils.OK(c, MenuTree(d.DB, uint(id), false))
		})

		d.Public.Get("/menus/:slug", func(c *fiber.Ctx) error {
			var m models.Menu
			if err := d.DB.Where("slug = ?", c.Params("slug")).First(&m).Error; err != nil {
				return utils.NotFound(c, "Menu not found")
			}
			return utils.OK(c, MenuTree(d.DB, m.ID, true))
		})
	})
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
