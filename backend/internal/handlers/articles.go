package handlers

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/middleware"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

// Reference implementation of an admin CRUD + public read endpoints.
// Other content handlers follow the same pattern.
func init() {
	Register(func(d *Deps) {
		// ----- admin -----
		crud := NewCrud(d.DB, CrudConfig[models.Article]{
			Entity:       "article",
			SearchFields: []string{"title", "excerpt", "slug"},
			SortFields:   []string{"id", "created_at", "updated_at", "published_at", "views", "status", "slug"},
			DefaultSort:  "-created_at",
			Preloads:     []string{"Category", "Author", "Tags"},
			Filters: func(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
				if s := c.Query("status"); s != "" {
					q = q.Where("status = ?", s)
				}
				if cat := c.QueryInt("category_id"); cat > 0 {
					q = q.Where("category_id = ?", cat)
				}
				if c.Query("featured") == "true" {
					q = q.Where("is_featured = ?", true)
				}
				return q
			},
			BeforeSave: func(c *fiber.Ctx, a *models.Article, isNew bool) error {
				def := DefaultLocale(d.DB)
				if strings.TrimSpace(a.Title.Get(def, "")) == "" {
					return errors.New("title is required")
				}
				if a.Slug == "" {
					a.Slug = a.Title.Get(def, "")
				}
				a.Slug = utils.UniqueSlug(d.DB, "articles", a.Slug, a.ID)
				if a.Status == "" {
					a.Status = models.StatusDraft
				}
				if a.Status == models.StatusPublished && a.PublishedAt == nil {
					now := time.Now()
					a.PublishedAt = &now
				}
				if isNew && a.AuthorID == nil {
					a.AuthorID = middleware.CurrentUserID(c)
				}
				return nil
			},
			AfterSave: func(c *fiber.Ctx, a *models.Article, isNew bool) error {
				// Tags: accept [{"id":1}] or [{"name":{"tk":"..."}}] (new tags are created).
				tags := make([]models.Tag, 0, len(a.Tags))
				for _, t := range a.Tags {
					if t.ID == 0 {
						name := t.Name.Get(DefaultLocale(d.DB), "")
						if name == "" {
							continue
						}
						t.Slug = utils.Slugify(name)
						var existing models.Tag
						if err := d.DB.Where("slug = ?", t.Slug).First(&existing).Error; err == nil {
							t = existing
						} else if err := d.DB.Create(&t).Error; err != nil {
							return err
						}
					}
					tags = append(tags, t)
				}
				return d.DB.Model(a).Association("Tags").Replace(tags)
			},
		})
		g := d.Admin.Group("/articles")
		crud.Register(g)

		// ----- public -----
		d.Public.Get("/articles", func(c *fiber.Ctx) error {
			locale := utils.Locale(c, DefaultLocale(d.DB))
			p := utils.ParseList(c, "-published_at", []string{"published_at", "views", "created_at"})
			q := d.DB.Model(&models.Article{}).Preload("Category").
				Where("status = ? AND (published_at IS NULL OR published_at <= ?)", models.StatusPublished, time.Now()).
				Where("JSON_UNQUOTE(JSON_EXTRACT(title, ?)) <> ''", "$."+locale)
			q = utils.ApplySearch(q, p.Search, []string{"title", "excerpt", "body"})
			if cat := c.Query("category"); cat != "" {
				q = q.Joins("JOIN categories ON categories.id = articles.category_id AND categories.slug = ?", cat)
			}
			if c.Query("featured") == "true" {
				q = q.Where("is_featured = ?", true)
			}
			if tag := c.Query("tag"); tag != "" {
				q = q.Joins("JOIN article_tags at ON at.article_id = articles.id JOIN tags ON tags.id = at.tag_id AND tags.slug = ?", tag)
			}
			var items []models.Article
			meta, err := utils.Paginate(q.Omit("body"), p, &items)
			if err != nil {
				return utils.ServerError(c, err)
			}
			for i := range items {
				items[i].Body = nil
			}
			if items == nil {
				items = []models.Article{}
			}
			return utils.Paginated(c, items, meta)
		})

		d.Public.Get("/articles/:slug", func(c *fiber.Ctx) error {
			var a models.Article
			err := d.DB.Preload("Category").Preload("Tags").Preload("Author").
				Where("slug = ? AND status = ?", c.Params("slug"), models.StatusPublished).First(&a).Error
			if err != nil {
				return utils.NotFound(c, "Article not found")
			}
			d.DB.Model(&a).UpdateColumn("views", gorm.Expr("views + 1"))
			if a.Author != nil {
				a.Author = &models.User{Base: a.Author.Base, Name: a.Author.Name, Avatar: a.Author.Avatar}
			}
			locale := utils.Locale(c, DefaultLocale(d.DB))
			var related []models.Article
			rq := d.DB.Model(&models.Article{}).Omit("body").Where("status = ? AND id <> ?", models.StatusPublished, a.ID).
				Where("JSON_UNQUOTE(JSON_EXTRACT(title, ?)) <> ''", "$."+locale)
			if a.CategoryID != nil {
				rq = rq.Where("category_id = ?", *a.CategoryID)
			}
			rq.Order("published_at DESC").Limit(4).Find(&related)
			for i := range related {
				related[i].Body = nil
			}
			return utils.OK(c, fiber.Map{"article": a, "related": related})
		})
	})
}
