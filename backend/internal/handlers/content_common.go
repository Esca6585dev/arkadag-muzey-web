package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// listFilled is the generic Crud list plus a post-processing hook (e.g. counts).
// Register it on the group BEFORE crud.Register so it takes precedence for GET /.
func listFilled[T any](h *Crud[T], fill func(items []T)) fiber.Handler {
	return func(c *fiber.Ctx) error {
		p := utils.ParseList(c, h.Cfg.DefaultSort, h.Cfg.SortFields)
		q := utils.ApplySearch(h.baseQuery(), p.Search, h.Cfg.SearchFields)
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
		if len(items) > 0 {
			fill(items)
		}
		return utils.Paginated(c, items, meta)
	}
}

// countBy returns map[id]count of rows in table grouped by col for the given ids.
func countBy(db *gorm.DB, table, col string, ids []uint, where string, args ...any) map[uint]int64 {
	type row struct {
		K uint
		N int64
	}
	var rows []row
	q := db.Table(table).Select(col+" AS k, COUNT(*) AS n").Where(col+" IN ?", ids)
	if where != "" {
		q = q.Where(where, args...)
	}
	q.Group(col).Scan(&rows)
	m := make(map[uint]int64, len(rows))
	for _, r := range rows {
		m[r.K] = r.N
	}
	return m
}

func requireTitle(def string, v interface{ Get(string, string) string }, field string) error {
	if strings.TrimSpace(v.Get(def, "")) == "" {
		return errors.New(field + " is required")
	}
	return nil
}
