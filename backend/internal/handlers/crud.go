package handlers

import (
	"errors"
	"reflect"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// CrudConfig configures a generic admin CRUD for model T.
type CrudConfig[T any] struct {
	Entity       string   // entity name for activity logs, e.g. "article"
	SearchFields []string // columns searched with LIKE (JSON columns are cast)
	SortFields   []string // allowed sort columns
	DefaultSort  string   // e.g. "-created_at"
	Preloads     []string // associations preloaded on list/get
	// Filters applies query-string filters to the list query.
	Filters func(c *fiber.Ctx, q *gorm.DB) *gorm.DB
	// BeforeSave can normalise/validate; return error to abort (400).
	BeforeSave func(c *fiber.Ctx, item *T, isNew bool) error
	// AfterSave handles associations etc.
	AfterSave func(c *fiber.Ctx, item *T, isNew bool) error
	// BeforeDelete can block deletion by returning an error (400).
	BeforeDelete func(c *fiber.Ctx, item *T) error
	// AfterDelete cleans up (files etc.).
	AfterDelete func(c *fiber.Ctx, item *T)
	// Validate returns field errors; defaults to utils.Validate.
	Validate func(item *T) map[string]string
}

// Crud provides List/Get/Create/Update/Delete/Reorder/BulkDelete handlers.
type Crud[T any] struct {
	DB  *gorm.DB
	Cfg CrudConfig[T]
}

func NewCrud[T any](db *gorm.DB, cfg CrudConfig[T]) *Crud[T] {
	if cfg.DefaultSort == "" {
		cfg.DefaultSort = "-id"
	}
	return &Crud[T]{DB: db, Cfg: cfg}
}

// Register mounts the standard routes on r:
// GET / , GET /:id , POST / , PUT /:id , DELETE /:id , POST /reorder , POST /bulk-delete
func (h *Crud[T]) Register(r fiber.Router) {
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Post("/reorder", h.Reorder)
	r.Post("/bulk-delete", h.BulkDelete)
	r.Get("/:id", h.Get)
	r.Put("/:id", h.Update)
	r.Patch("/:id", h.Update)
	r.Delete("/:id", h.Delete)
}

func (h *Crud[T]) baseQuery() *gorm.DB {
	q := h.DB.Model(new(T))
	for _, p := range h.Cfg.Preloads {
		q = q.Preload(p)
	}
	return q
}

func (h *Crud[T]) List(c *fiber.Ctx) error {
	p := utils.ParseList(c, h.Cfg.DefaultSort, h.Cfg.SortFields)
	q := h.baseQuery()
	q = utils.ApplySearch(q, p.Search, h.Cfg.SearchFields)
	if h.Cfg.Filters != nil {
		q = h.Cfg.Filters(c, q)
	}
	var items []T
	meta, err := utils.Paginate(q, p, &items)
	if err != nil {
		return utils.ServerError(c, err)
	}
	if items == nil {
		items = []T{}
	}
	return utils.Paginated(c, items, meta)
}

func (h *Crud[T]) Get(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil || id <= 0 {
		return utils.BadRequest(c, "Invalid id")
	}
	var item T
	if err := h.baseQuery().First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NotFound(c, "")
		}
		return utils.ServerError(c, err)
	}
	return utils.OK(c, item)
}

func (h *Crud[T]) Create(c *fiber.Ctx) error {
	var item T
	if err := c.BodyParser(&item); err != nil {
		return utils.BadRequest(c, "Invalid JSON body: "+err.Error())
	}
	setID(&item, 0)
	if h.Cfg.BeforeSave != nil {
		if err := h.Cfg.BeforeSave(c, &item, true); err != nil {
			return utils.BadRequest(c, err.Error())
		}
	}
	if fields := h.validate(&item); len(fields) > 0 {
		return utils.ValidationError(c, fields)
	}
	// Select("*") makes GORM persist zero values (e.g. is_active=false) instead of column defaults.
	if err := h.DB.Select("*").Omit(clause.Associations).Create(&item).Error; err != nil {
		return utils.ServerError(c, err)
	}
	if h.Cfg.AfterSave != nil {
		if err := h.Cfg.AfterSave(c, &item, true); err != nil {
			return utils.ServerError(c, err)
		}
	}
	LogActivity(c, h.DB, "create", h.Cfg.Entity, getID(&item), nil)
	_ = h.baseQuery().First(&item, getID(&item)).Error
	return utils.Created(c, item)
}

func (h *Crud[T]) Update(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil || id <= 0 {
		return utils.BadRequest(c, "Invalid id")
	}
	var item T
	if err := h.DB.First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NotFound(c, "")
		}
		return utils.ServerError(c, err)
	}
	// Overlay the JSON body onto the existing record: absent fields keep their values.
	if err := c.BodyParser(&item); err != nil {
		return utils.BadRequest(c, "Invalid JSON body: "+err.Error())
	}
	setID(&item, uint(id))
	if h.Cfg.BeforeSave != nil {
		if err := h.Cfg.BeforeSave(c, &item, false); err != nil {
			return utils.BadRequest(c, err.Error())
		}
	}
	if fields := h.validate(&item); len(fields) > 0 {
		return utils.ValidationError(c, fields)
	}
	if err := h.DB.Omit(clause.Associations).Save(&item).Error; err != nil {
		return utils.ServerError(c, err)
	}
	if h.Cfg.AfterSave != nil {
		if err := h.Cfg.AfterSave(c, &item, false); err != nil {
			return utils.ServerError(c, err)
		}
	}
	LogActivity(c, h.DB, "update", h.Cfg.Entity, uint(id), nil)
	_ = h.baseQuery().First(&item, id).Error
	return utils.OK(c, item)
}

func (h *Crud[T]) Delete(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil || id <= 0 {
		return utils.BadRequest(c, "Invalid id")
	}
	var item T
	if err := h.DB.First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NotFound(c, "")
		}
		return utils.ServerError(c, err)
	}
	if h.Cfg.BeforeDelete != nil {
		if err := h.Cfg.BeforeDelete(c, &item); err != nil {
			return utils.BadRequest(c, err.Error())
		}
	}
	if err := h.DB.Select(clause.Associations).Delete(&item).Error; err != nil {
		return utils.ServerError(c, err)
	}
	if h.Cfg.AfterDelete != nil {
		h.Cfg.AfterDelete(c, &item)
	}
	LogActivity(c, h.DB, "delete", h.Cfg.Entity, uint(id), nil)
	return utils.Message(c, "Deleted")
}

// Reorder sets sort_order by the order of ids in {"ids":[...]}.
func (h *Crud[T]) Reorder(c *fiber.Ctx) error {
	ids, err := utils.ParseIDs(c)
	if err != nil {
		return utils.BadRequest(c, "Invalid body")
	}
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := tx.Model(new(T)).Where("id = ?", id).Update("sort_order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return utils.ServerError(c, err)
	}
	return utils.Message(c, "Reordered")
}

func (h *Crud[T]) BulkDelete(c *fiber.Ctx) error {
	ids, err := utils.ParseIDs(c)
	if err != nil || len(ids) == 0 {
		return utils.BadRequest(c, "No ids provided")
	}
	var items []T
	if err := h.DB.Find(&items, ids).Error; err != nil {
		return utils.ServerError(c, err)
	}
	deleted := 0
	for i := range items {
		if h.Cfg.BeforeDelete != nil && h.Cfg.BeforeDelete(c, &items[i]) != nil {
			continue
		}
		if err := h.DB.Select(clause.Associations).Delete(&items[i]).Error; err == nil {
			deleted++
			if h.Cfg.AfterDelete != nil {
				h.Cfg.AfterDelete(c, &items[i])
			}
			LogActivity(c, h.DB, "delete", h.Cfg.Entity, getID(&items[i]), nil)
		}
	}
	return utils.OK(c, fiber.Map{"deleted": deleted})
}

func (h *Crud[T]) validate(item *T) map[string]string {
	if h.Cfg.Validate != nil {
		return h.Cfg.Validate(item)
	}
	return utils.Validate(item)
}

func getID(item any) uint {
	v := reflect.ValueOf(item).Elem().FieldByName("ID")
	if v.IsValid() && v.CanUint() {
		return uint(v.Uint())
	}
	return 0
}

func setID(item any, id uint) {
	v := reflect.ValueOf(item).Elem().FieldByName("ID")
	if v.IsValid() && v.CanSet() {
		v.SetUint(uint64(id))
	}
}
