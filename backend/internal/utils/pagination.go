package utils

import (
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

var identRe = regexp.MustCompile(`^[a-z_][a-z0-9_.]*$`)

// ListParams holds parsed list query parameters.
type ListParams struct {
	Page   int
	Limit  int
	Sort   string // column name
	Desc   bool
	Search string
}

func (p ListParams) Offset() int { return (p.Page - 1) * p.Limit }

// ParseList parses ?page=&limit=&sort=-field&search= with a sort whitelist.
func ParseList(c *fiber.Ctx, defaultSort string, allowed []string) ListParams {
	p := ListParams{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Search: strings.TrimSpace(c.Query("search", c.Query("q"))),
	}
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 {
		p.Limit = 20
	}
	if p.Limit > 200 {
		p.Limit = 200
	}
	sort := strings.TrimSpace(c.Query("sort", defaultSort))
	if sort == "" {
		sort = defaultSort
	}
	desc := false
	if strings.HasPrefix(sort, "-") {
		desc = true
		sort = sort[1:]
	}
	ok := identRe.MatchString(sort)
	if ok && len(allowed) > 0 {
		ok = false
		for _, a := range allowed {
			if a == sort {
				ok = true
				break
			}
		}
	}
	if !ok {
		sort = strings.TrimPrefix(defaultSort, "-")
		desc = strings.HasPrefix(defaultSort, "-")
	}
	p.Sort = sort
	p.Desc = desc
	return p
}

// ApplySort adds ORDER BY to the query.
func ApplySort(q *gorm.DB, p ListParams) *gorm.DB {
	if p.Sort == "" {
		return q
	}
	dir := "ASC"
	if p.Desc {
		dir = "DESC"
	}
	return q.Order(quoteIdent(p.Sort) + " " + dir)
}

// quoteIdent backtick-quotes a column (or table.column) so reserved words like `key` work.
func quoteIdent(col string) string {
	parts := strings.Split(col, ".")
	for i, p := range parts {
		parts[i] = "`" + p + "`"
	}
	return strings.Join(parts, ".")
}

// ApplySearch adds a LIKE search across columns (JSON columns are cast to text).
func ApplySearch(q *gorm.DB, search string, columns []string) *gorm.DB {
	search = strings.TrimSpace(search)
	if search == "" || len(columns) == 0 {
		return q
	}
	like := "%" + search + "%"
	parts := make([]string, 0, len(columns))
	args := make([]any, 0, len(columns))
	for _, col := range columns {
		if !identRe.MatchString(col) {
			continue
		}
		parts = append(parts, "CAST("+quoteIdent(col)+" AS CHAR) LIKE ?")
		args = append(args, like)
	}
	if len(parts) == 0 {
		return q
	}
	return q.Where("("+strings.Join(parts, " OR ")+")", args...)
}

// Paginate counts and fetches a page into dest. q must already have model/filters.
func Paginate(q *gorm.DB, p ListParams, dest any) (Meta, error) {
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return Meta{}, err
	}
	meta := Meta{Page: p.Page, Limit: p.Limit, Total: total}
	meta.Pages = int((total + int64(p.Limit) - 1) / int64(p.Limit))
	if err := ApplySort(q, p).Offset(p.Offset()).Limit(p.Limit).Find(dest).Error; err != nil {
		return meta, err
	}
	return meta, nil
}
