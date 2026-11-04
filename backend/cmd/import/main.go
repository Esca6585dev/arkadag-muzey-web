// Command import migrates content from the legacy Joomla 3 database into the new schema.
//
//	go run ./cmd/import -legacy-dsn "root:@tcp(127.0.0.1:3306)/museum_legacy?charset=utf8mb4&parseTime=True" \
//	   -legacy-files D:/arkadagmuzey/legacy_site_files/museum [-prefix gtc81_] [-dry-run] [-skip-images]
package main

import (
	"flag"
	"fmt"
	"html"
	"io"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/database"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

var (
	legacyDSN   = flag.String("legacy-dsn", "root:@tcp(127.0.0.1:3306)/museum_legacy?charset=utf8mb4&parseTime=True", "legacy Joomla MySQL DSN")
	legacyFiles = flag.String("legacy-files", "D:/arkadagmuzey/legacy_site_files/museum", "path to the legacy site root (contains images/)")
	prefix      = flag.String("prefix", "gtc81_", "legacy Joomla table prefix ($dbprefix in configuration.php)")
	dryRun      = flag.Bool("dry-run", false, "do not write anything")
	skipImages  = flag.Bool("skip-images", false, "do not copy image files")
)

var (
	reImgSrc   = regexp.MustCompile(`(?i)(src=["'])((?:https?://(?:www\.)?arkadagshahermuzey\.gov\.tm)?/?images/[^"']+)(["'])`)
	reImgAttrs = regexp.MustCompile(`(?i)\s+(width|height|style)=["'][^"']*["']`)
	reTags     = regexp.MustCompile(`<[^>]+>`)
	reSpaces   = regexp.MustCompile(`\s+`)
	reHR       = regexp.MustCompile(`(?i)<hr\s*/?>`)
	reEmptyP   = regexp.MustCompile(`(?i)<p>\s*(&nbsp;|\s)*</p>`)
)

type stats struct {
	inserted, updated, skipped, imgCopied, imgMissing, hallsUpdated int
}

type legacyArticle struct {
	ID        int
	Title     string
	Alias     string
	Introtext string
	Fulltext  string
	State     int
	Created   time.Time
	PublishUp *time.Time
	Modified  *time.Time
	Hits      int64
	Language  string
	Images    string
	Metadesc  string
}

type legacyHall struct {
	ID          int
	Title       string
	Description string
	Language    string
}

func main() {
	flag.Parse()
	cfg := config.Load()

	legacy, err := gorm.Open(mysql.Open(*legacyDSN), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatalf("legacy db: %v", err)
	}
	target, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("target db: %v", err)
	}
	if err := database.Migrate(target); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	st := &stats{}
	imp := &importer{legacy: legacy, target: target, cfg: cfg, st: st}
	imp.run()

	fmt.Printf("\nDone. articles: inserted=%d updated=%d skipped=%d | images copied=%d missing=%d | halls updated=%d%s\n",
		st.inserted, st.updated, st.skipped, st.imgCopied, st.imgMissing, st.hallsUpdated, map[bool]string{true: " (dry run)"}[*dryRun])
}

type importer struct {
	legacy, target *gorm.DB
	cfg            *config.Config
	st             *stats
	copied         map[string]bool
}

func (im *importer) run() {
	im.copied = map[string]bool{}
	catID := im.ensureCategory()
	authorID := im.adminID()
	im.importArticles(catID, authorID)
	im.importHalls()
}

func (im *importer) ensureCategory() *uint {
	var cat models.Category
	if err := im.target.Where("slug = ?", "news").First(&cat).Error; err != nil {
		cat = models.Category{Slug: "news", Name: models.Translatable{"tk": "Täzelikler", "ru": "Новости", "en": "News"}, IsActive: true}
		if *dryRun {
			return nil
		}
		if err := im.target.Create(&cat).Error; err != nil {
			log.Fatalf("create category: %v", err)
		}
	}
	return &cat.ID
}

func (im *importer) adminID() *uint {
	var u models.User
	if err := im.target.Where("role = ?", models.RoleAdmin).Order("id").First(&u).Error; err != nil {
		return nil
	}
	return &u.ID
}

func mapLang(l string) string {
	switch strings.ToLower(strings.TrimSpace(l)) {
	case "ru-ru":
		return "ru"
	case "en-gb":
		return "en"
	default:
		return "tk"
	}
}

func (im *importer) importArticles(catID, authorID *uint) {
	var rows []legacyArticle
	err := im.legacy.Raw("SELECT id, title, alias, introtext, `fulltext`, state, created, publish_up, modified, hits, language, images, metadesc FROM " + *prefix + "content WHERE state IN (0,1) ORDER BY id").Scan(&rows).Error
	if err != nil {
		log.Fatalf("read legacy articles: %v", err)
	}
	log.Printf("legacy articles: %d", len(rows))

	for _, r := range rows {
		lang := mapLang(r.Language)
		title := cleanTitle(r.Title)
		if title == "" {
			im.st.skipped++
			continue
		}
		body := cleanBody(r.Introtext + "\n" + r.Fulltext)
		body, bodyImages := im.rewriteImages(body)
		if strings.TrimSpace(reTags.ReplaceAllString(body, "")) == "" && len(bodyImages) == 0 {
			im.st.skipped++
			continue
		}
		cover := ""
		if img := im.legacyImageField(r.Images); img != "" {
			cover = im.copyImage(img)
		}
		if cover == "" && len(bodyImages) > 0 {
			cover = bodyImages[0]
		}

		status := models.StatusDraft
		var publishedAt *time.Time
		if r.State == 1 {
			status = models.StatusPublished
			p := r.Created
			if r.PublishUp != nil && r.PublishUp.Year() > 1970 {
				p = *r.PublishUp
			}
			publishedAt = &p
		}
		updated := r.Created
		if r.Modified != nil && r.Modified.Year() > 1970 {
			updated = *r.Modified
		}

		var existing models.Article
		found := im.target.Where("legacy_id = ?", r.ID).Limit(1).Find(&existing).RowsAffected > 0

		a := existing
		a.LegacyID = &r.ID
		a.Title = models.Translatable{lang: title}
		a.Body = models.Translatable{lang: body}
		a.Excerpt = models.Translatable{lang: makeExcerpt(body, 200)}
		if r.Metadesc != "" {
			a.MetaDescription = models.Translatable{lang: strings.TrimSpace(r.Metadesc)}
		}
		a.CoverImage = cover
		a.Images = models.StringList(bodyImages)
		a.CategoryID = catID
		a.Status = status
		a.PublishedAt = publishedAt
		a.Views = r.Hits
		if !found {
			a.AuthorID = authorID
			a.Slug = utils.UniqueSlug(im.target, "articles", firstNonEmpty(r.Alias, title), 0)
			a.CreatedAt = r.Created
		}
		a.UpdatedAt = updated

		if *dryRun {
			if found {
				im.st.updated++
			} else {
				im.st.inserted++
			}
			continue
		}
		if found {
			if err := im.target.Model(&existing).Select("*").Omit("id", "created_at", "slug", "author_id").Updates(&a).Error; err != nil {
				log.Printf("update article %d: %v", r.ID, err)
				continue
			}
			im.st.updated++
		} else {
			if err := im.target.Create(&a).Error; err != nil {
				log.Printf("insert article %d: %v", r.ID, err)
				continue
			}
			im.st.inserted++
		}
	}
}

var hallMap = map[string]map[string]int{
	"ethnography":         {"tk": 1, "ru": 13, "en": 14},
	"independence":        {"tk": 2, "ru": 15, "en": 16},
	"history-archaeology": {"tk": 3, "ru": 12, "en": 11},
	"nature":              {"tk": 4, "ru": 8, "en": 9},
	"fine-arts":           {"tk": 5, "ru": 6, "en": 7},
}

func (im *importer) importHalls() {
	var rows []legacyHall
	if err := im.legacy.Raw("SELECT id, title, description, language FROM " + *prefix + "advportfoliopro_projects").Scan(&rows).Error; err != nil {
		log.Printf("read legacy halls: %v", err)
		return
	}
	byID := map[int]legacyHall{}
	for _, r := range rows {
		byID[r.ID] = r
	}
	for slug, langs := range hallMap {
		var hall models.Hall
		if err := im.target.Where("slug = ?", slug).First(&hall).Error; err != nil {
			log.Printf("hall %s not found in target, skipping", slug)
			continue
		}
		if hall.Description == nil {
			hall.Description = models.Translatable{}
		}
		changed := false
		for lang, id := range langs {
			r, ok := byID[id]
			if !ok {
				continue
			}
			desc := reHR.ReplaceAllString(cleanBody(r.Description), "")
			desc, _ = im.rewriteImages(desc)
			desc = strings.TrimSpace(desc)
			if desc != "" {
				hall.Description[lang] = desc
				changed = true
			}
		}
		if changed && !*dryRun {
			if err := im.target.Model(&hall).Update("description", hall.Description).Error; err != nil {
				log.Printf("update hall %s: %v", slug, err)
				continue
			}
		}
		if changed {
			im.st.hallsUpdated++
		}
	}
}

// ---------- helpers ----------

func cleanTitle(s string) string {
	s = strings.TrimSpace(html.UnescapeString(s))
	if len(s) >= 2 && (s[0] == '"' || s[0] == '«') && (s[len(s)-1] == '"' || s[len(s)-1] == '»') {
		s = strings.TrimSpace(s[1 : len(s)-1])
	}
	return reSpaces.ReplaceAllString(s, " ")
}

func cleanBody(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\\t", "")
	s = strings.ReplaceAll(s, "\t", "")
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if !strings.Contains(strings.ToLower(s), "<p") {
		var parts []string
		for _, para := range regexp.MustCompile(`\n\s*\n|\n`).Split(s, -1) {
			para = strings.TrimSpace(para)
			if para != "" {
				parts = append(parts, "<p>"+para+"</p>")
			}
		}
		s = strings.Join(parts, "\n")
	}
	// normalise nested <p><p>
	s = strings.ReplaceAll(s, "<p><p>", "<p>")
	s = strings.ReplaceAll(s, "</p></p>", "</p>")
	s = reEmptyP.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

func makeExcerpt(htmlBody string, n int) string {
	text := strings.TrimSpace(reSpaces.ReplaceAllString(html.UnescapeString(reTags.ReplaceAllString(htmlBody, " ")), " "))
	if len([]rune(text)) <= n {
		return text
	}
	s := string([]rune(text)[:n])
	cut := strings.LastIndex(s, " ")
	if cut < len(s)/2 {
		cut = len(s)
	}
	return strings.TrimSpace(s[:cut]) + "…"
}

// rewriteImages copies referenced legacy images and rewrites src attributes; returns new HTML and image URLs.
func (im *importer) rewriteImages(h string) (string, []string) {
	var urls []string
	seen := map[string]bool{}
	out := reImgSrc.ReplaceAllStringFunc(h, func(m string) string {
		sub := reImgSrc.FindStringSubmatch(m)
		src := sub[2]
		if i := strings.Index(src, "/images/"); i >= 0 {
			src = src[i+1:]
		}
		src = strings.TrimPrefix(src, "/")
		newURL := im.copyImage(src)
		if newURL == "" {
			return m
		}
		if !seen[newURL] {
			seen[newURL] = true
			urls = append(urls, newURL)
		}
		return sub[1] + newURL + sub[3]
	})
	out = reImgAttrs.ReplaceAllString(out, "")
	return out, urls
}

// copyImage copies <legacy-files>/<rel> to <UploadDir>/legacy/<rel> and returns the public URL ("" when missing).
func (im *importer) copyImage(rel string) string {
	rel = strings.TrimPrefix(strings.ReplaceAll(html.UnescapeString(rel), "\\", "/"), "/")
	if i := strings.IndexAny(rel, "?#"); i >= 0 {
		rel = rel[:i]
	}
	if rel == "" || strings.Contains(rel, "..") {
		return ""
	}
	url := utils.PublicURL(im.cfg, path.Join("legacy", rel))
	if im.copied[rel] {
		return url
	}
	src := filepath.Join(*legacyFiles, filepath.FromSlash(rel))
	if _, err := os.Stat(src); err != nil {
		im.st.imgMissing++
		return ""
	}
	im.copied[rel] = true
	if *skipImages || *dryRun {
		im.st.imgCopied++
		return url
	}
	dst := filepath.Join(im.cfg.UploadDir, "legacy", filepath.FromSlash(rel))
	if _, err := os.Stat(dst); err == nil {
		im.st.imgCopied++
		return url
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return ""
	}
	in, err := os.Open(src)
	if err != nil {
		return ""
	}
	defer in.Close()
	o, err := os.Create(dst)
	if err != nil {
		return ""
	}
	defer o.Close()
	if _, err := io.Copy(o, in); err != nil {
		return ""
	}
	im.st.imgCopied++
	return url
}

// legacyImageField extracts image_fulltext or image_intro from Joomla's images JSON.
func (im *importer) legacyImageField(js string) string {
	for _, key := range []string{"image_fulltext", "image_intro"} {
		re := regexp.MustCompile(`"` + key + `"\s*:\s*"([^"]*)"`)
		if m := re.FindStringSubmatch(js); len(m) == 2 {
			v := strings.ReplaceAll(m[1], "\\/", "/")
			if i := strings.Index(v, "#"); i >= 0 {
				v = v[:i]
			}
			v = strings.TrimSpace(v)
			if v != "" {
				return v
			}
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
