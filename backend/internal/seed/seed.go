// Package seed fills an empty database with languages, the admin user, default
// settings, menus, pages (block based), halls, exhibits, slides and a gallery so the
// site looks complete after the first start. Existing rows are never overwritten.
package seed

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/config"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/models"
	"github.com/Esca6585dev/arkadag-muzey-web/backend/internal/utils"
)

type T = models.Translatable

func tr(tk, ru, en string) T { return T{"tk": tk, "ru": ru, "en": en} }

func j(v any) models.JSON {
	b, _ := json.Marshal(v)
	return models.JSON(b)
}

func img(name string) string { return "/uploads/seed/" + name }

// Run executes all seeders.
func Run(db *gorm.DB, cfg *config.Config) error {
	copySeedImages(cfg)
	steps := []func(*gorm.DB, *config.Config) error{
		languages, adminUser, settings, menus, categories, halls, exhibits, slides, galleries, pages, events,
	}
	for _, s := range steps {
		if err := s(db, cfg); err != nil {
			return err
		}
	}
	return nil
}

func copySeedImages(cfg *config.Config) {
	srcDir := os.Getenv("SEED_IMAGES_DIR")
	if srcDir == "" {
		srcDir = "./seed/images"
	}
	entries, err := os.ReadDir(srcDir)
	if err != nil {
		return
	}
	dst := filepath.Join(cfg.UploadDir, "seed")
	_ = os.MkdirAll(dst, 0o755)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		target := filepath.Join(dst, e.Name())
		if _, err := os.Stat(target); err == nil {
			continue
		}
		in, err := os.Open(filepath.Join(srcDir, e.Name()))
		if err != nil {
			continue
		}
		out, err := os.Create(target)
		if err == nil {
			_, _ = io.Copy(out, in)
			out.Close()
		}
		in.Close()
	}
}

func empty(db *gorm.DB, model any) bool {
	var n int64
	db.Model(model).Count(&n)
	return n == 0
}

func languages(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Language{}) {
		return nil
	}
	return db.Create(&[]models.Language{
		{Code: "tk", Name: "Turkmen", NativeName: "Türkmençe", Flag: "🇹🇲", IsDefault: true, IsEnabled: true, SortOrder: 1},
		{Code: "ru", Name: "Russian", NativeName: "Русский", Flag: "🇷🇺", IsEnabled: true, SortOrder: 2},
		{Code: "en", Name: "English", NativeName: "English", Flag: "🇬🇧", IsEnabled: true, SortOrder: 3},
	}).Error
}

func adminUser(db *gorm.DB, cfg *config.Config) error {
	var n int64
	db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&n)
	if n > 0 {
		return nil
	}
	hash, err := utils.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}
	log.Printf("creating admin user %s", cfg.AdminEmail)
	return db.Create(&models.User{Name: cfg.AdminName, Email: strings.ToLower(cfg.AdminEmail), Password: hash, Role: models.RoleAdmin, Status: "active", Locale: "tk"}).Error
}

type settingDef struct {
	key, group, typ, label string
	value                  any
	public                 bool
}

func settings(db *gorm.DB, _ *config.Config) error {
	defs := []settingDef{
		// general
		{"site.name", "general", "translatable", "Site name", tr("Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi", "Историко-краеведческий музей города Аркадаг", "Arkadag City Museum of History and Local Lore"), true},
		{"site.short_name", "general", "translatable", "Short name", tr("Arkadag muzeýi", "Музей Аркадага", "Arkadag Museum"), true},
		{"site.tagline", "general", "translatable", "Tagline", tr("Biziň maksadymyz medeni mirasy gorap saklamak", "Наша миссия - сохранение культурного наследия", "Our mission is to preserve cultural heritage"), true},
		{"site.logo", "general", "image", "Logo", img("logo.png"), true},
		{"site.logo_dark", "general", "image", "Logo (dark theme)", img("logo.png"), true},
		{"site.favicon", "general", "image", "Favicon", img("logo.png"), true},
		{"site.description", "general", "translatable_textarea", "Site description", tr("Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi — Ahal welaýatynyň taryhyny, medeniýetini we tebigatyny açyp görkezýän döwrebap muzeý.", "Историко-краеведческий музей города Аркадаг — современный музей, раскрывающий историю, культуру и природу Ахалского велаята.", "The Arkadag City Museum of History and Local Lore is a modern museum presenting the history, culture and nature of the Ahal region."), true},
		// contact
		{"contact.phone", "contact", "text", "Phone", "+993 12 571989", true},
		{"contact.phone2", "contact", "text", "Phone 2", "", true},
		{"contact.email", "contact", "text", "Email", "arkadagshahermuzey@sanly.tm", true},
		{"contact.address", "contact", "translatable", "Address", tr("Türkmenistan, Arkadag ş., Keýmir kör şaýoly, 1-nji jaý", "Туркменистан, г. Аркадаг, улица Кеймир кёр, дом 1", "Keymir kor street 1, Arkadag city, Turkmenistan"), true},
		{"contact.working_hours", "contact", "translatable_textarea", "Working hours", tr("Sişenbe – Ýekşenbe: 09:00 – 18:00\nDuşenbe: dynç güni", "Вторник – Воскресенье: 09:00 – 18:00\nПонедельник: выходной", "Tuesday – Sunday: 09:00 – 18:00\nMonday: closed"), true},
		{"contact.map_embed", "contact", "textarea", "Map embed URL (Google/Yandex iframe src)", "https://www.google.com/maps?q=Arkadag%20city%20museum&output=embed", true},
		{"contact.map_lat", "contact", "text", "Map latitude", "37.9820", true},
		{"contact.map_lng", "contact", "text", "Map longitude", "58.3740", true},
		// social
		{"social.facebook", "social", "text", "Facebook", "", true},
		{"social.instagram", "social", "text", "Instagram", "", true},
		{"social.youtube", "social", "text", "YouTube", "", true},
		{"social.telegram", "social", "text", "Telegram", "", true},
		{"social.tiktok", "social", "text", "TikTok", "", true},
		// appearance
		{"theme.primary", "appearance", "color", "Primary color", "#0f6e56", true},
		{"theme.accent", "appearance", "color", "Accent color", "#c9a24a", true},
		{"theme.default_mode", "appearance", "select", "Default theme mode", "system", true},
		{"theme.radius", "appearance", "select", "Corner radius", "md", true},
		{"theme.show_top_bar", "appearance", "bool", "Show top info bar", true, true},
		// home
		{"home.stats", "home", "json", "Statistics counters", []map[string]any{
			{"value": "352", "suffix": "", "label": tr("Eksponat", "Экспонатов", "Exhibits")},
			{"value": "120", "suffix": "+", "label": tr("Sungat eseri", "Произведений искусства", "Works of art")},
			{"value": "5", "suffix": "", "label": tr("Bölüm", "Разделов", "Halls")},
			{"value": "50", "suffix": "+", "label": tr("Täzelik", "Новостей", "News")},
		}, true},
		{"home.news_count", "home", "number", "News on home page", 4, true},
		{"home.show_events", "home", "bool", "Show events on home page", true, true},
		// footer
		{"footer.about", "footer", "translatable_textarea", "Footer about text", tr("Ahal welaýatynyň taryhynyň we medeniýetiniň baýlygyny öwreniň.", "Откройте для себя богатство истории и культуры Ахалского велаята.", "Discover the rich history and culture of the Ahal region."), true},
		{"footer.copyright", "footer", "translatable", "Copyright", tr("© {year} Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi. Ähli hukuklar goralan.", "© {year} Историко-краеведческий музей города Аркадаг. Все права защищены.", "© {year} Arkadag City Museum of History and Local Lore. All rights reserved."), true},
		// seo
		{"seo.title", "seo", "translatable", "Default meta title", tr("Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi", "Историко-краеведческий музей города Аркадаг", "Arkadag City Museum of History and Local Lore"), true},
		{"seo.description", "seo", "translatable_textarea", "Default meta description", tr("Ahal welaýatynyň taryhy, medeniýeti we tebigaty barada resmi muzeý saýty.", "Официальный сайт музея: история, культура и природа Ахалского велаята.", "Official museum website: history, culture and nature of the Ahal region."), true},
		{"seo.og_image", "seo", "image", "Default share image", img("hero-1.jpg"), true},
		// features
		{"features.registration", "features", "bool", "Allow user registration", true, true},
		{"features.newsletter", "features", "bool", "Enable newsletter subscription", true, true},
		{"features.favorites", "features", "bool", "Enable favorites for users", true, true},
		{"features.search", "features", "bool", "Enable site search", true, true},
		// visit
		{"visit.tickets", "visit", "translatable_textarea", "Ticket prices", tr("Uly adamlar: 5 manat\nTalyplar we mekdep okuwçylary: 2 manat\n7 ýaşa çenli çagalar: mugt", "Взрослые: 5 манат\nСтуденты и школьники: 2 маната\nДети до 7 лет: бесплатно", "Adults: 5 TMT\nStudents and pupils: 2 TMT\nChildren under 7: free"), true},
		{"visit.rules", "visit", "translatable_textarea", "Visitor rules", tr("Eksponatlara el degirmeň.\nSuratа düşürmek ýörite rugsat bilen.\nSergi zallarynda sessizligi saklaň.", "Не прикасайтесь к экспонатам.\nФотосъёмка по специальному разрешению.\nСоблюдайте тишину в залах.", "Please do not touch the exhibits.\nPhotography with special permission.\nKeep silence in the halls."), true},
		{"visit.guided_tours", "visit", "translatable_textarea", "Guided tours", tr("Ekskursiýalar türkmen, rus we iňlis dillerinde geçirilýär. Toparlaýyn gezelençler öňünden ýazylmagy talap edýär.", "Экскурсии проводятся на туркменском, русском и английском языках. Групповые посещения — по предварительной записи.", "Guided tours are available in Turkmen, Russian and English. Group visits require advance booking."), true},
		// external
		{"external.virtual_museum_url", "external", "text", "Virtual museum URL", "https://virtualmuseum.gov.tm/", true},
		// mail (private)
		{"mail.notify_email", "mail", "text", "Notification email for contact form", "arkadagshahermuzey@sanly.tm", false},
	}
	for i, d := range defs {
		var n int64
		db.Model(&models.Setting{}).Where("`key` = ?", d.key).Count(&n)
		if n > 0 {
			continue
		}
		s := models.Setting{Key: d.key, Group: d.group, Type: d.typ, Label: d.label, Value: j(d.value), IsPublic: d.public, SortOrder: i}
		if d.key == "theme.default_mode" {
			s.Options = j([]map[string]string{{"value": "system", "label": "System"}, {"value": "light", "label": "Light"}, {"value": "dark", "label": "Dark"}})
		}
		if d.key == "theme.radius" {
			s.Options = j([]map[string]string{{"value": "none", "label": "Square"}, {"value": "sm", "label": "Small"}, {"value": "md", "label": "Medium"}, {"value": "lg", "label": "Large"}})
		}
		if err := db.Create(&s).Error; err != nil {
			return err
		}
	}
	return nil
}

func menus(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Menu{}) {
		return nil
	}
	header := models.Menu{Slug: "header", Name: "Header menu"}
	footer := models.Menu{Slug: "footer", Name: "Footer menu"}
	if err := db.Create(&header).Error; err != nil {
		return err
	}
	if err := db.Create(&footer).Error; err != nil {
		return err
	}
	items := []models.MenuItem{
		{MenuID: header.ID, Title: tr("Baş sahypa", "Главная", "Home"), URL: "/", SortOrder: 0},
		{MenuID: header.ID, Title: tr("Muzeý barada", "О музее", "About"), URL: "/about", SortOrder: 1},
		{MenuID: header.ID, Title: tr("Bölümler", "Разделы музея", "Halls"), URL: "/halls", SortOrder: 2},
		{MenuID: header.ID, Title: tr("Eksponatlar", "Экспонаты", "Exhibits"), URL: "/exhibits", SortOrder: 3},
		{MenuID: header.ID, Title: tr("Täzelikler", "Новости", "News"), URL: "/news", SortOrder: 4},
		{MenuID: header.ID, Title: tr("Çäreler", "События", "Events"), URL: "/events", SortOrder: 5},
		{MenuID: header.ID, Title: tr("Galereýa", "Галерея", "Gallery"), URL: "/gallery", SortOrder: 6},
		{MenuID: header.ID, Title: tr("Wirtual muzeý", "Виртуальный музей", "Virtual museum"), Type: "external", URL: "https://virtualmuseum.gov.tm/", Target: "_blank", SortOrder: 7},
		{MenuID: header.ID, Title: tr("Habarlaşmak", "Контакты", "Contact"), URL: "/contact", SortOrder: 8},

		{MenuID: footer.ID, Title: tr("Muzeý barada", "О музее", "About"), URL: "/about", SortOrder: 0},
		{MenuID: footer.ID, Title: tr("Sapar maglumaty", "Посетителям", "Plan your visit"), URL: "/visit", SortOrder: 1},
		{MenuID: footer.ID, Title: tr("Bölümler", "Разделы музея", "Halls"), URL: "/halls", SortOrder: 2},
		{MenuID: footer.ID, Title: tr("Täzelikler", "Новости", "News"), URL: "/news", SortOrder: 3},
		{MenuID: footer.ID, Title: tr("Galereýa", "Галерея", "Gallery"), URL: "/gallery", SortOrder: 4},
		{MenuID: footer.ID, Title: tr("Habarlaşmak", "Контакты", "Contact"), URL: "/contact", SortOrder: 5},
	}
	for i := range items {
		if items[i].Type == "" {
			items[i].Type = "link"
		}
		if items[i].Target == "" {
			items[i].Target = "_self"
		}
		items[i].IsActive = true
	}
	return db.Create(&items).Error
}

func categories(db *gorm.DB, _ *config.Config) error {
	defaults := []models.Category{
		{Slug: "news", Name: tr("Täzelikler", "Новости", "News"), SortOrder: 0, IsActive: true},
		{Slug: "events", Name: tr("Wakalar", "События", "Events"), SortOrder: 1, IsActive: true},
		{Slug: "articles", Name: tr("Makalalar", "Статьи", "Articles"), SortOrder: 2, IsActive: true},
	}
	for _, cat := range defaults {
		var n int64
		db.Model(&models.Category{}).Where("slug = ?", cat.Slug).Count(&n)
		if n == 0 {
			if err := db.Create(&cat).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func halls(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Hall{}) {
		return nil
	}
	return db.Create(&[]models.Hall{
		{Slug: "ethnography", Icon: "shirt", SortOrder: 0, IsActive: true, CoverImage: img("hall-ethnography.jpg"),
			Images:  models.StringList{img("hall-ethnography-1.jpg"), img("hall-ethnography-2.jpg"), img("hall-ethnography-3.jpg")},
			Name:    tr("Etnografiýa bölümi", "Зал этнографии", "Hall of Ethnography"),
			Summary: tr("Ahal welaýatynyň medeniýetini, däp-dessurlaryny öwrenmäge bagyşlanýar.", "Посвящён изучению культур, обычаев и традиций Ахалского велаята.", "Dedicated to the cultures, customs and traditions of the Ahal region."),
			Description: tr("<p>Etnografiýa bölüminde türkmen halkynyň müňýyllyklaryň dowamynda döreden maddy we ruhy medeniýetiniň köpdürli görnüşleri diaramalaryň we gymmatlyklaryň asyl nusgalary bilen giňden beýan edilýär. Milli egin-eşikler, şaý-sepler, haly we haly önümleri, öý-hojalyk esbaplary türkmen durmuşynyň özboluşly keşbini açyp görkezýär.</p>",
				"<p>В зале этнографии представлены разнообразные формы материальной и духовной культуры туркменского народа, созданные на протяжении тысячелетий: национальная одежда, ювелирные украшения, ковры и ковровые изделия, предметы быта. Диорамы и подлинные экспонаты раскрывают неповторимый облик туркменской жизни.</p>",
				"<p>The Hall of Ethnography presents the material and spiritual culture created by the Turkmen people over millennia: national dress, jewellery, carpets and carpet products and household items. Dioramas and original artefacts reveal the unique character of Turkmen life.</p>")},
		{Slug: "nature", Icon: "leaf", SortOrder: 1, IsActive: true, CoverImage: img("hall-nature.jpg"),
			Images:  models.StringList{img("hall-nature-1.jpg"), img("hall-nature-2.jpg"), img("hall-nature-3.jpg")},
			Name:    tr("Tebigat bölümi", "Зал природы края", "Hall of Nature"),
			Summary: tr("Sebitdäki ösümlik we haýwanat dünýäsiniň baýlygyna we dürlüligine bagyşlanýar.", "Посвящён богатству и многообразию флоры и фауны края.", "Dedicated to the richness and diversity of the region's flora and fauna."),
			Description: tr("<p>Tebigat bölümi Ahal welaýatynyň özboluşly tebigatyny — Köpetdagyň daglyk ýerlerini, Garagum çölüni we derýa jülgelerini diaramalar arkaly janlandyrýar. Bu ýerde sebitiň seýrek duş gelýän haýwanlary, guşlary, ösümlikleri we kömelekleri görkezilýär.</p>",
				"<p>Зал природы воссоздаёт с помощью диорам неповторимую природу Ахалского велаята — горы Копетдага, пустыню Каракумы и речные долины. Здесь представлены редкие животные, птицы, растения и грибы региона.</p>",
				"<p>The Hall of Nature recreates the unique landscapes of the Ahal region through dioramas: the Kopetdag mountains, the Karakum desert and river valleys. Rare animals, birds, plants and fungi of the region are on display.</p>")},
		{Slug: "independence", Icon: "flag", SortOrder: 2, IsActive: true, CoverImage: img("hall-independence.jpg"),
			Images:  models.StringList{img("hall-independence.jpg")},
			Name:    tr("Garaşsyzlyk bölümi", "Зал Независимости", "Hall of Independence"),
			Summary: tr("Garaşsyzlyk ýyllarynda ýetilen sepgitlere bagyşlanýar.", "Посвящён истории обретения независимости страны.", "Dedicated to the achievements of the years of independence."),
			Description: tr("<p>Garaşsyzlyk bölüminde Türkmenistanyň Garaşsyzlyk ýyllarynda gazanan üstünlikleri, Arkadag şäheriniň gurluşygy we ösüşi, döwlet nyşanlary hem-de ýurdumyzyň halkara abraýyny görkezýän materiallar ýerleşdirilen.</p>",
				"<p>В зале Независимости представлены достижения Туркменистана за годы независимости, строительство и развитие города Аркадаг, государственные символы и материалы, отражающие международный авторитет страны.</p>",
				"<p>The Hall of Independence presents Turkmenistan's achievements during the years of independence, the construction and growth of Arkadag city, state symbols and materials reflecting the country's international standing.</p>")},
		{Slug: "fine-arts", Icon: "palette", SortOrder: 3, IsActive: true, CoverImage: img("hall-art.jpg"),
			Images:  models.StringList{img("hall-art-1.jpg"), img("hall-art-2.jpg")},
			Name:    tr("Sungat bölümi", "Зал изобразительного искусства", "Hall of Fine Arts"),
			Summary: tr("Surat, grafika, heýkeltaraşlyk we şekillendiriş sungatynyň beýleki görnüşlerine bagyşlanýar.", "Посвящён искусству живописи, графики, скульптуры и другим формам изобразительного искусства.", "Dedicated to painting, graphics, sculpture and other forms of fine art."),
			Description: tr("<p>Sungat bölüminde türkmen suratkeşleriniň we heýkeltaraşlarynyň eserleri, milli nagyşlar, amaly-haşam sungatynyň nusgalary görkezilýär. Ekspozisiýa halkymyzyň çeperçilik däpleriniň döwrebap sungat bilen sazlaşygyny açyp görkezýär.</p>",
				"<p>В зале изобразительного искусства экспонируются произведения туркменских художников и скульпторов, национальные орнаменты, образцы декоративно-прикладного искусства. Экспозиция раскрывает гармонию художественных традиций народа и современного искусства.</p>",
				"<p>The Hall of Fine Arts displays works by Turkmen painters and sculptors, national ornaments and examples of decorative and applied art, showing the harmony between the people's artistic traditions and contemporary art.</p>")},
		{Slug: "history-archaeology", Icon: "landmark", SortOrder: 4, IsActive: true, CoverImage: img("hall-history.jpg"),
			Images:  models.StringList{img("hall-history.jpg")},
			Name:    tr("Taryh we arheologiýa bölümi", "Зал истории и археологии", "Hall of History and Archaeology"),
			Summary: tr("Ahal topragynda ýaşan ata-babalaryň durmuş taryhyna we däp-dessurlaryna bagyşlanýar.", "Посвящён истории жизни и традициям предков, проживавших на территории Ахалского велаята.", "Dedicated to the history and traditions of the ancestors who lived in the Ahal region."),
			Description: tr("<p>Taryh we arheologiýa bölüminde Änew, Nusaý, Gökdepe ýaly gadymy ýadygärliklerden tapylan arheologik tapyndylar, gadymy küýzegärçilik önümleri, zähmet gurallary we ýaraglar görkezilýär. Ekspozisiýa daş asyryndan şu güne çenli sebitiň taryhyny yzygiderli beýan edýär.</p>",
				"<p>В зале истории и археологии представлены археологические находки из древних памятников Анау, Нисы, Гёкдепе, древняя керамика, орудия труда и оружие. Экспозиция последовательно раскрывает историю региона от каменного века до наших дней.</p>",
				"<p>The Hall of History and Archaeology presents archaeological finds from the ancient sites of Anau, Nisa and Gokdepe, ancient pottery, tools and weapons. The exhibition traces the history of the region from the Stone Age to the present day.</p>")},
	}).Error
}

func exhibits(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Exhibit{}) {
		return nil
	}
	hallID := func(slug string) *uint {
		var h models.Hall
		if err := db.Where("slug = ?", slug).First(&h).Error; err != nil {
			return nil
		}
		return &h.ID
	}
	items := []models.Exhibit{
		{Slug: "mele-haran", Image: img("exhibit-1.jpg"), HallID: hallID("ethnography"), IsFeatured: true, SortOrder: 0,
			Title: tr("Mele haran", "Меле харан", "Mele Haran"), Period: tr("XIX asyr", "XIX век", "19th century"),
			Summary: tr("Türkmen zenanlarynyň däp bolan milli bezegi.", "Традиционное национальное украшение туркменских женщин.", "A traditional national adornment of Turkmen women.")},
		{Slug: "nusay-metopasy", Image: img("exhibit-2.jpg"), HallID: hallID("history-archaeology"), IsFeatured: true, SortOrder: 1,
			Title: tr("Nusaý metopasy", "Метопа Нисы", "Nisa metope"), Period: tr("B.e.öň III–I asyrlar", "III–I вв. до н.э.", "3rd–1st century BC"),
			Summary: tr("Gadymy Nusaý galasynyň binagärlik bezeginiň nusgasy.", "Образец архитектурного декора древней крепости Ниса.", "An example of architectural decoration from the ancient fortress of Nisa.")},
		{Slug: "gokdepe", Image: img("exhibit-3.jpg"), HallID: hallID("history-archaeology"), IsFeatured: true, SortOrder: 2,
			Title: tr("Gökdepe galasy", "Крепость Гёкдепе", "Gokdepe fortress"), Period: tr("XIX asyr", "XIX век", "19th century"),
			Summary: tr("Gökdepe galasynyň taryhyna degişli ýadygärlik materiallary.", "Памятные материалы, связанные с историей крепости Гёкдепе.", "Memorial materials relating to the history of the Gokdepe fortress.")},
		{Slug: "anew", Image: img("exhibit-4.jpg"), HallID: hallID("history-archaeology"), IsFeatured: true, SortOrder: 3,
			Title: tr("Änew medeniýeti", "Культура Анау", "Anau culture"), Period: tr("B.e.öň V–III müňýyllyklar", "V–III тыс. до н.э.", "5th–3rd millennium BC"),
			Summary: tr("Änew depelerinden tapylan gadymy küýzegärçilik önümleri.", "Древняя керамика, найденная на холмах Анау.", "Ancient pottery found at the Anau mounds.")},
		{Slug: "altyn-shaylar", Image: img("exhibit-5.jpg"), HallID: hallID("ethnography"), IsFeatured: true, SortOrder: 4,
			Title: tr("Altyn şaý-sepler", "Золотые украшения", "Gold jewellery"), Period: tr("XIX–XX asyrlar", "XIX–XX вв.", "19th–20th century"),
			Summary: tr("Türkmen zergärçilik sungatynyň ajaýyp nusgalary.", "Великолепные образцы туркменского ювелирного искусства.", "Magnificent examples of Turkmen jewellery art.")},
		{Slug: "chaga-shaylary", Image: img("exhibit-6.jpg"), HallID: hallID("ethnography"), IsFeatured: true, SortOrder: 5,
			Title: tr("Çaga şaý-sepleri", "Детские украшения", "Children's jewellery"), Period: tr("XX asyr", "XX век", "20th century"),
			Summary: tr("Çagalary gorap saklamak üçin niýetlenen däp bolan bezegler.", "Традиционные украшения-обереги для детей.", "Traditional protective adornments for children.")},
	}
	for i := range items {
		items[i].Status = models.StatusPublished
		items[i].Description = items[i].Summary
	}
	return db.Create(&items).Error
}

func slides(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Slide{}) {
		return nil
	}
	return db.Create(&[]models.Slide{
		{Image: img("hero-1.jpg"), Position: "home", SortOrder: 0, IsActive: true,
			Title:      tr("Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi", "Историко-краеведческий музей города Аркадаг", "Arkadag City Museum of History and Local Lore"),
			Subtitle:   tr("Biziň maksadymyz medeni mirasy gorap saklamak", "Наша миссия — сохранение культурного наследия", "Our mission is to preserve cultural heritage"),
			ButtonText: tr("Muzeý barada", "О музее", "About the museum"), ButtonURL: "/about",
			Button2Text: tr("Wirtual syýahat", "Виртуальный тур", "Virtual tour"), Button2URL: "https://virtualmuseum.gov.tm/"},
		{Image: img("hero-2.jpg"), Position: "home", SortOrder: 1, IsActive: true,
			Title:      tr("Ahal welaýatynyň taryhy we medeniýeti", "История и культура Ахалского велаята", "History and culture of the Ahal region"),
			Subtitle:   tr("Bäş bölümde müňýyllyklaryň mirasy", "Наследие тысячелетий в пяти залах", "Millennia of heritage in five halls"),
			ButtonText: tr("Bölümler", "Разделы музея", "Explore the halls"), ButtonURL: "/halls"},
		{Image: img("hero-3.jpg"), Position: "home", SortOrder: 2, IsActive: true,
			Title:      tr("Gymmat bahaly eksponatlar", "Ценные экспонаты", "Valuable exhibits"),
			Subtitle:   tr("Änew, Nusaý we Gökdepe ýadygärliklerinden tapyndylar", "Находки из памятников Анау, Нисы и Гёкдепе", "Finds from Anau, Nisa and Gokdepe"),
			ButtonText: tr("Eksponatlar", "Экспонаты", "View exhibits"), ButtonURL: "/exhibits"},
	}).Error
}

func galleries(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Gallery{}) {
		return nil
	}
	g := models.Gallery{Slug: "museum-halls", CoverImage: img("hall-ethnography-1.jpg"), IsActive: true,
		Title:       tr("Muzeýiň zallary", "Залы музея", "Museum halls"),
		Description: tr("Muzeýiň ekspozisiýa zallaryndan suratlar.", "Фотографии экспозиционных залов музея.", "Photographs of the museum's exhibition halls.")}
	if err := db.Create(&g).Error; err != nil {
		return err
	}
	names := []string{"hall-ethnography-1.jpg", "hall-ethnography-2.jpg", "hall-ethnography-3.jpg", "hall-nature-1.jpg", "hall-nature-2.jpg", "hall-nature-3.jpg", "hall-art-1.jpg", "hall-art-2.jpg", "hall-history.jpg", "hall-independence.jpg"}
	items := make([]models.GalleryItem, 0, len(names))
	for i, n := range names {
		items = append(items, models.GalleryItem{GalleryID: g.ID, Image: img(n), SortOrder: i})
	}
	return db.Create(&items).Error
}

func events(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Event{}) {
		return nil
	}
	start := time.Now().AddDate(0, 0, 14).Truncate(24 * time.Hour).Add(10 * time.Hour)
	end := start.Add(3 * time.Hour)
	return db.Create(&[]models.Event{
		{Slug: "open-doors-day", Image: img("hall-art-1.jpg"), StartsAt: start, EndsAt: &end, Status: models.StatusPublished, IsFeatured: true,
			Title:    tr("Açyk gapylar güni", "День открытых дверей", "Open doors day"),
			Summary:  tr("Muzeýiň ähli bölümlerine mugt gezelenç we ekskursiýalar.", "Бесплатное посещение всех залов музея и экскурсии.", "Free admission to all halls and guided tours."),
			Location: tr("Muzeýiň esasy binasy", "Главное здание музея", "Main museum building"), Price: tr("Mugt", "Бесплатно", "Free")},
	}).Error
}

type block struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Settings map[string]any `json:"settings"`
}

func pages(db *gorm.DB, _ *config.Config) error {
	if !empty(db, &models.Page{}) {
		return nil
	}
	history := tr(
		"<p>Arkadag şäheriniň Taryhy we ülkäni öwreniş muzeýi 2023-nji ýylda Türkmen halkynyň Milli Lideri Gahryman Arkadagymyzyň tagallasy we Arkadagly Gahryman Serdarymyzyň goldawy bilen döredildi. Muzeý Ahal welaýatynyň taryhyny, medeniýetini we tebigatyny döwrebap serişdeler arkaly açyp görkezýär.</p><p>Muzeýiň bäş bölüminde etnografiýa, tebigat, Garaşsyzlyk, şekillendiriş sungaty hem-de taryh we arheologiýa boýunça müňlerçe gymmatlyk saklanýar.</p>",
		"<p>Историко-краеведческий музей города Аркадаг был создан в 2023 году при неоценимой поддержке Национального Лидера туркменского народа Героя-Аркадага и Президента Туркменистана Сердара Бердымухамедова. Музей представляет историю, культуру и природу Ахалского велаята с помощью современных средств экспонирования.</p><p>В пяти залах музея — этнографии, природы, Независимости, изобразительного искусства, истории и археологии — хранятся тысячи ценностей.</p>",
		"<p>The Arkadag City Museum of History and Local Lore was founded in 2023 with the support of the National Leader of the Turkmen people, Hero-Arkadag, and President Serdar Berdimuhamedov. The museum presents the history, culture and nature of the Ahal region using modern means of display.</p><p>Thousands of treasures are kept in the museum's five halls: ethnography, nature, independence, fine arts, and history and archaeology.</p>",
	)
	homeBlocks := []block{
		{"hero", "hero", map[string]any{"source": "slides", "height": "full"}},
		{"about", "about_intro", map[string]any{
			"label":       tr("Hoş geldiňiz", "Добро пожаловать", "Welcome"),
			"title":       tr("Muzeýiň döreýiş taryhy", "История создания музея", "History of the museum"),
			"text":        history,
			"images":      []string{img("about-1.jpg"), img("about-2.jpg")},
			"button_text": tr("Doly okamak", "Читать", "Read more"), "button_url": "/about",
			"show_stats": true}},
		{"halls", "halls_grid", map[string]any{
			"label": tr("Kategoriýalar", "Категории", "Categories"),
			"title": tr("Muzeýiň bölümleri", "Разделы музея", "Museum halls"),
			"limit": 6, "button_text": tr("Ähli bölümler", "Все разделы", "All halls"), "button_url": "/halls"}},
		{"exhibits", "exhibits_featured", map[string]any{
			"label": tr("Gyzykly", "Интересное", "Highlights"),
			"title": tr("Gymmat bahaly eksponatlar", "Ценные экспонаты", "Valuable exhibits"),
			"limit": 6, "button_text": tr("Ähli eksponatlar", "Все экспонаты", "All exhibits"), "button_url": "/exhibits"}},
		{"news", "latest_news", map[string]any{
			"label": tr("Täzelikler", "Новости", "News"),
			"title": tr("Soňky täzelikler we wakalar", "Последние новости и события", "Latest news and events"),
			"limit": 4, "button_text": tr("Ähli täzelikler", "Все новости", "All news"), "button_url": "/news"}},
		{"events", "events_upcoming", map[string]any{
			"label": tr("Çäreler", "События", "Events"),
			"title": tr("Ýakynda geçiriljek çäreler", "Ближайшие события", "Upcoming events"),
			"limit": 3, "button_url": "/events"}},
		{"gallery", "gallery_strip", map[string]any{
			"title": tr("Galereýa", "Галерея", "Gallery"), "gallery_slug": "museum-halls", "limit": 8, "button_url": "/gallery"}},
		{"visit", "visit_cta", map[string]any{
			"label":    tr("Ýerleşýän ýeri", "Местоположение", "Location"),
			"title":    tr("Biz bärde", "Мы находимся здесь", "Find us here"),
			"text":     tr("Ahal welaýatynyň taryhynyň we medeniýetiniň baýlygyny öwreniň.", "Откройте для себя богатство истории и культуры Ахалского велаята.", "Discover the rich history and culture of the Ahal region."),
			"show_map": true, "button_text": tr("Habarlaşmak", "Связаться с нами", "Contact us"), "button_url": "/contact"}},
	}
	aboutBlocks := []block{
		{"header", "page_header", map[string]any{"image": img("hero-2.jpg"), "title": tr("Muzeý barada", "О музее", "About the museum"), "subtitle": tr("Biziň maksadymyz medeni mirasy gorap saklamak", "Наша миссия — сохранение культурного наследия", "Our mission is to preserve cultural heritage")}},
		{"history", "image_text", map[string]any{"label": tr("Hoş geldiňiz", "Добро пожаловать", "Welcome"), "title": tr("Muzeýiň döreýiş taryhy", "История создания музея", "History of the museum"), "text": history, "image": img("about-1.jpg"), "image2": img("about-2.jpg"), "image_position": "right"}},
		{"stats", "stats", map[string]any{"source": "settings"}},
		{"mission", "features", map[string]any{
			"title": tr("Biziň wezipelerimiz", "Наши задачи", "Our mission"),
			"items": []map[string]any{
				{"icon": "shield", "title": tr("Gorap saklamak", "Сохранение", "Preservation"), "text": tr("Ahal welaýatynyň maddy we ruhy mirasyny toplamak, öwrenmek we gorap saklamak.", "Сбор, изучение и сохранение материального и духовного наследия Ахалского велаята.", "Collecting, studying and preserving the material and spiritual heritage of the Ahal region.")},
				{"icon": "book-open", "title": tr("Bilim bermek", "Просвещение", "Education"), "text": tr("Ekskursiýalar, sapaklar we çäreler arkaly ýaş nesli taryhymyz bilen tanyşdyrmak.", "Знакомство молодого поколения с историей через экскурсии, уроки и мероприятия.", "Introducing the younger generation to history through tours, lessons and events.")},
				{"icon": "globe", "title": tr("Wagyz etmek", "Популяризация", "Promotion"), "text": tr("Türkmen medeniýetini ýurdumyzda we dünýäde wagyz etmek.", "Популяризация туркменской культуры в стране и мире.", "Promoting Turkmen culture at home and abroad.")},
			}}},
		{"halls", "halls_grid", map[string]any{"title": tr("Muzeýiň bölümleri", "Разделы музея", "Museum halls"), "limit": 6}},
	}
	contactBlocks := []block{
		{"header", "page_header", map[string]any{"image": img("hero-3.jpg"), "title": tr("Habarlaşmak", "Контакты", "Contact us"), "subtitle": tr("Soraglaryňyz bolsa, bize ýazyň ýa-da jaň ediň", "Напишите или позвоните нам", "Write or call us")}},
		{"contact", "contact", map[string]any{"show_form": true, "show_map": true, "show_info": true}},
	}
	visitBlocks := []block{
		{"header", "page_header", map[string]any{"image": img("hero-1.jpg"), "title": tr("Sapar maglumaty", "Посетителям", "Plan your visit"), "subtitle": tr("Iş wagty, petekler we düzgünler", "Часы работы, билеты и правила", "Opening hours, tickets and rules")}},
		{"info", "visit_info", map[string]any{"source": "settings"}},
		{"faq", "faq", map[string]any{"title": tr("Köp berilýän soraglar", "Часто задаваемые вопросы", "Frequently asked questions"), "items": []map[string]any{
			{"question": tr("Muzeýe nädip barmaly?", "Как добраться до музея?", "How do I get to the museum?"), "answer": tr("Muzeý Arkadag şäheriniň merkezinde, Keýmir kör şaýolunyň 1-nji jaýynda ýerleşýär.", "Музей расположен в центре города Аркадаг, улица Кеймир кёр, дом 1.", "The museum is located in the centre of Arkadag city, Keymir kor street 1.")},
			{"question": tr("Surata düşmek bolýarmy?", "Можно ли фотографировать?", "Is photography allowed?"), "answer": tr("Hawa, fleşsiz surata düşmek rugsat berilýär. Professional surata düşmek üçin öňünden rugsat almaly.", "Да, разрешена съёмка без вспышки. Для профессиональной съёмки необходимо получить разрешение заранее.", "Yes, photography without flash is allowed. Professional shoots require advance permission.")},
			{"question": tr("Toparlaýyn ekskursiýa nädip sargyt etmeli?", "Как заказать групповую экскурсию?", "How can I book a group tour?"), "answer": tr("Telefon arkaly ýa-da habarlaşmak sahypasyndaky forma arkaly ýüz tutup bilersiňiz.", "Позвоните нам или заполните форму на странице контактов.", "Call us or fill in the form on the contact page.")},
		}}},
	}
	mk := func(slug string, title T, blocks []block, cover string, system bool) models.Page {
		return models.Page{Slug: slug, Title: title, Blocks: j(blocks), CoverImage: cover, Template: "default", Status: models.StatusPublished, IsSystem: system, MetaTitle: title}
	}
	return db.Create(&[]models.Page{
		mk("home", tr("Baş sahypa", "Главная", "Home"), homeBlocks, img("hero-1.jpg"), true),
		mk("about", tr("Muzeý barada", "О музее", "About the museum"), aboutBlocks, img("hero-2.jpg"), true),
		mk("contact", tr("Habarlaşmak", "Контакты", "Contact us"), contactBlocks, img("hero-3.jpg"), true),
		mk("visit", tr("Sapar maglumaty", "Посетителям", "Plan your visit"), visitBlocks, img("hero-1.jpg"), false),
	}).Error
}
