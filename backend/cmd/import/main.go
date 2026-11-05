// Command import migrates content from the legacy Joomla 3 site into the new schema:
// news (with their photo galleries, all languages merged into one article), events
// (event-type news), photo albums (one per news gallery) and the museum hall texts.
// It is idempotent: re-running updates the same rows instead of duplicating them.
//
//	go run ./cmd/import -legacy-dsn "root:@tcp(127.0.0.1:3306)/museum_legacy?charset=utf8mb4&parseTime=True" \
//	   -legacy-files D:/arkadagmuzey/legacy_site_files/museum [-prefix gtc81_] [-dry-run] [-skip-images]
package main

import (
	"flag"
	"fmt"
	"html"
	"image"
	"io"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/disintegration/imaging"
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
	maxSide     = flag.Int("max-image-side", 2200, "downscale copied JPEG/PNG images larger than this (0 = copy as is)")
)

var (
	reImgSrc   = regexp.MustCompile(`(?i)(src=["'])((?:https?://(?:www\.)?arkadagshahermuzey\.gov\.tm)?/?images/[^"']+)(["'])`)
	reImgAttrs = regexp.MustCompile(`(?i)\s+(width|height|style)=["'][^"']*["']`)
	reTags     = regexp.MustCompile(`<[^>]+>`)
	reSpaces   = regexp.MustCompile(`\s+`)
	reHR       = regexp.MustCompile(`(?i)<hr\s*/?>`)
	reEmptyP   = regexp.MustCompile(`(?i)<p>\s*(&nbsp;|\s)*</p>`)
	reLines    = regexp.MustCompile(`\n\s*\n|\n`)
)

type stats struct {
	articlesNew, articlesUpdated, articlesMerged, skipped int
	eventsNew, eventsUpdated                              int
	galleriesNew, galleriesUpdated, photos                int
	imgCopied, imgMissing, hallsUpdated                   int
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
	target = target.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Error)})

	st := &stats{}
	imp := &importer{legacy: legacy, target: target, cfg: cfg, st: st, copied: map[string]string{}}
	imp.run()

	dry := ""
	if *dryRun {
		dry = " (dry run, nothing written)"
	}
	fmt.Printf("\nDone%s.\n", dry)
	fmt.Printf("  news:      %d new, %d updated, %d language duplicates merged, %d skipped (empty)\n", st.articlesNew, st.articlesUpdated, st.articlesMerged, st.skipped)
	fmt.Printf("  events:    %d new, %d updated\n", st.eventsNew, st.eventsUpdated)
	fmt.Printf("  galleries: %d new, %d updated, %d photos\n", st.galleriesNew, st.galleriesUpdated, st.photos)
	fmt.Printf("  images:    %d copied, %d missing on disk\n", st.imgCopied, st.imgMissing)
	fmt.Printf("  halls:     %d descriptions updated\n", st.hallsUpdated)
}

type importer struct {
	legacy, target *gorm.DB
	cfg            *config.Config
	st             *stats
	copied         map[string]string // legacy rel path -> public URL
}

func (im *importer) run() {
	newsCat := im.ensureCategory("news", models.Translatable{"tk": "Täzelikler", "ru": "Новости", "en": "News"}, 0)
	eventsCat := im.ensureCategory("events", models.Translatable{"tk": "Wakalar", "ru": "События", "en": "Events"}, 1)
	im.importContent(newsCat, eventsCat, im.adminID())
	im.importHalls()
}

func (im *importer) ensureCategory(slug string, name models.Translatable, order int) *uint {
	var cat models.Category
	if err := im.target.Where("slug = ?", slug).First(&cat).Error; err != nil {
		cat = models.Category{Slug: slug, Name: name, IsActive: true, SortOrder: order}
		if *dryRun {
			return nil
		}
		if err := im.target.Create(&cat).Error; err != nil {
			log.Fatalf("create category %s: %v", slug, err)
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

// ---------- halls ----------

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

// ---------- text helpers ----------

func cleanTitle(s string) string {
	s = strings.TrimSpace(html.UnescapeString(s))
	r := []rune(s)
	if len(r) >= 2 && (r[0] == '"' || r[0] == '«' || r[0] == '“') && (r[len(r)-1] == '"' || r[len(r)-1] == '»' || r[len(r)-1] == '”') {
		inner := string(r[1 : len(r)-1])
		// only strip when the quotes wrap the whole title, not «A» and «B»
		if !strings.ContainsAny(inner, "\"«»“”") {
			s = strings.TrimSpace(inner)
		}
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
		for _, para := range reLines.Split(s, -1) {
			para = strings.TrimSpace(para)
			if para != "" {
				parts = append(parts, "<p>"+para+"</p>")
			}
		}
		s = strings.Join(parts, "\n")
	} else {
		// text written after the closing </p> of the intro (Joomla intro + fulltext) becomes paragraphs too
		var b strings.Builder
		for _, line := range strings.Split(s, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if !strings.HasPrefix(line, "<") {
				line = "<p>" + line + "</p>"
			}
			b.WriteString(line)
			b.WriteByte('\n')
		}
		s = b.String()
	}
	for strings.Contains(s, "<p><p>") || strings.Contains(s, "</p></p>") {
		s = strings.ReplaceAll(s, "<p><p>", "<p>")
		s = strings.ReplaceAll(s, "</p></p>", "</p>")
	}
	s = reEmptyP.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

func plainText(h string) string {
	return strings.TrimSpace(reSpaces.ReplaceAllString(html.UnescapeString(reTags.ReplaceAllString(h, " ")), " "))
}

func makeExcerpt(htmlBody string, n int) string {
	text := plainText(htmlBody)
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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// ---------- images ----------

// rewriteImages copies images referenced in HTML and rewrites their src; returns the new HTML and image URLs.
func (im *importer) rewriteImages(h string) (string, []string) {
	var urls []string
	seen := map[string]bool{}
	out := reImgSrc.ReplaceAllStringFunc(h, func(m string) string {
		sub := reImgSrc.FindStringSubmatch(m)
		src := sub[2]
		if i := strings.Index(src, "/images/"); i >= 0 {
			src = src[i+1:]
		}
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

func normaliseRel(rel string) string {
	rel = strings.TrimSpace(strings.ReplaceAll(html.UnescapeString(rel), "\\", "/"))
	if i := strings.IndexAny(rel, "?#"); i >= 0 {
		rel = rel[:i]
	}
	if i := strings.Index(rel, "/images/"); i >= 0 && strings.HasPrefix(rel, "http") {
		rel = rel[i+1:]
	}
	return strings.TrimPrefix(rel, "/")
}

// safeRel maps a legacy path to a URL-safe destination path (ASCII file name, same folders).
func safeRel(rel string) string {
	dir, file := path.Split(rel)
	ext := strings.ToLower(path.Ext(file))
	base := utils.Slugify(strings.TrimSuffix(file, path.Ext(file)))
	if base == "" {
		base = utils.HashToken(rel)[:12]
	}
	var parts []string
	for _, p := range strings.Split(strings.Trim(dir, "/"), "/") {
		if s := utils.Slugify(p); s != "" {
			parts = append(parts, s)
		}
	}
	return path.Join(append(parts, base+ext)...)
}

// copyImage copies <legacy-files>/<rel> to <UploadDir>/legacy/<safe rel> (downscaling large photos)
// and returns its public URL, or "" when the file is missing.
func (im *importer) copyImage(rel string) string {
	rel = normaliseRel(rel)
	if rel == "" || strings.Contains(rel, "..") {
		return ""
	}
	if u, ok := im.copied[rel]; ok {
		return u
	}
	src := filepath.Join(*legacyFiles, filepath.FromSlash(rel))
	if _, err := os.Stat(src); err != nil {
		im.st.imgMissing++
		im.copied[rel] = ""
		return ""
	}
	destRel := path.Join("legacy", safeRel(rel))
	url := utils.PublicURL(im.cfg, destRel)
	im.copied[rel] = url
	im.st.imgCopied++
	if *skipImages || *dryRun {
		return url
	}
	dst := filepath.Join(im.cfg.UploadDir, filepath.FromSlash(destRel))
	if _, err := os.Stat(dst); err == nil {
		return url
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		log.Printf("mkdir %s: %v", filepath.Dir(dst), err)
		return url
	}
	if err := copyOrResize(src, dst); err != nil {
		log.Printf("copy %s: %v", rel, err)
		im.copied[rel] = ""
		return ""
	}
	return url
}

func copyOrResize(src, dst string) error {
	ext := strings.ToLower(filepath.Ext(src))
	if *maxSide > 0 && (ext == ".jpg" || ext == ".jpeg" || ext == ".png") {
		if f, err := os.Open(src); err == nil {
			cfg, _, err := image.DecodeConfig(f)
			f.Close()
			if err == nil && (cfg.Width > *maxSide || cfg.Height > *maxSide) {
				img, err := imaging.Open(src, imaging.AutoOrientation(true))
				if err == nil {
					img = imaging.Fit(img, *maxSide, *maxSide, imaging.Lanczos)
					return imaging.Save(img, dst, imaging.JPEGQuality(84))
				}
			}
		}
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// legacyImageField extracts image_fulltext or image_intro from Joomla's images JSON.
func legacyImageField(js string) string {
	for _, key := range []string{"image_fulltext", "image_intro"} {
		re := regexp.MustCompile(`"` + key + `"\s*:\s*"([^"]*)"`)
		if m := re.FindStringSubmatch(js); len(m) == 2 {
			v := strings.ReplaceAll(m[1], "\\/", "/")
			if i := strings.Index(v, "#"); i >= 0 {
				v = v[:i]
			}
			if v = strings.TrimSpace(v); v != "" {
				return v
			}
		}
	}
	return ""
}
