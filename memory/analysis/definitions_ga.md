
#### 3.3.1 Custom Dimensions (Event scope)

| Nama Dimension      | Parameter             | Event utama                                                                             | Prioritas |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------- | --------- |
| Article ID          | `article_id`          | `view_article`, `article_read_complete`, `article_share`, `select_content`, `push_open` | Wajib     |
| Article Slug        | `article_slug`        | `view_article`, `article_read_complete`, `article_share`, `select_content`              | Wajib     |
| Article Title       | `article_title`       | `view_article`, `article_read_complete`, `article_share`, `select_content`              | Wajib     |
| Article Format      | `article_format`      | `view_article`, `article_read_complete`                                                 | Wajib     |
| Author ID           | `author_id`           | `view_article`, `author_profile_view`                                                   | Wajib     |
| Author Name         | `author_name`         | `view_article`, `author_profile_view`                                                   | Wajib     |
| Author Slug         | `author_slug`         | `author_profile_view`                                                                   | Fase 2    |
| Category ID         | `category_id`         | `view_article`                                                                          | Wajib     |
| Category Name       | `category_name`       | `view_article`, `article_read_complete`, `article_share`, `select_content`, `push_open` | Wajib     |
| Category Slug       | `category_slug`       | `view_article`                                                                          | Wajib     |
| Tag 1               | `tag_1`               | `view_article`                                                                          | Wajib     |
| Tag 2               | `tag_2`               | `view_article`                                                                          | Wajib     |
| Tag 3               | `tag_3`               | `view_article`                                                                          | Wajib     |
| Is Breaking         | `is_breaking`         | `view_article`                                                                          | Wajib     |
| Is Headline         | `is_headline`         | `view_article`                                                                          | Wajib     |
| Content Page        | `content_page`        | `view_article`                                                                          | Wajib     |
| Has Video           | `has_video`           | `view_article`                                                                          | Wajib     |
| Has Gallery         | `has_gallery`         | `view_article`                                                                          | Wajib     |
| Publish Day of Week | `publish_day_of_week` | `view_article`                                                                          | Wajib     |
| User Type           | `user_type`           | `view_article`                                                                          | Wajib     |
| Referrer Type       | `referrer_type`       | `view_article`                                                                          | Wajib     |
| Session Source      | `session_source`      | `view_article`                                                                          | Wajib     |
| Scroll Depth        | `scroll_depth`        | `article_read_complete`                                                                 | Fase 2    |
| Share Method        | `share_method`        | `article_share`                                                                         | Fase 2    |
| Content Type        | `content_type`        | `select_content`                                                                        | Fase 2    |
| Click Location      | `click_location`      | `select_content`                                                                        | Fase 2    |
| Search Term         | `search_term`         | `search`                                                                                | Fase 2    |
| Ad ID               | `ad_id`               | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Position         | `ad_position`         | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Size             | `ad_size`             | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Sponsor          | `ad_sponsor`          | `ad_impression`, `ad_click`                                                             | Fase 3    |
| Ad Destination URL  | `ad_destination_url`  | `ad_click`                                                                              | Fase 3    |
| Notification ID     | `notification_id`     | `push_open`                                                                             | Fase 3    |
| Notification Title  | `notification_title`  | `push_open`                                                                             | Fase 3    |

**Total: 34 Custom Dimensions** — masih di bawah batas 50 (GA4 free tier).

> **Catatan `content_id` di `select_content`:** GA4 event standar memakai `content_type` + `item_id`. Di implementasi kode, isi `item_id` dengan `article_id` — tidak perlu dimension terpisah selama `article_id` sudah terdaftar.

#### 3.3.2 Custom Metrics (Event scope)

Parameter numerik lebih tepat sebagai **Custom Metric** agar bisa di-aggregate (AVG, SUM) di Looker Studio.

| Nama Metric            | Parameter              | Event utama             | Tipe    |
| ---------------------- | ---------------------- | ----------------------- | ------- |
| Article Age Days       | `article_age_days`     | `view_article`          | Integer |
| Word Count             | `word_count`           | `view_article`          | Integer |
| Publish Hour           | `publish_hour`         | `view_article`          | Integer |
| Time on Page (seconds) | `time_on_page_seconds` | `article_read_complete` | Integer |
| Click Position         | `position`             | `select_content`        | Integer |
| Search Results Count   | `results_count`        | `search`                | Integer |

**Total: 6 Custom Metrics** — masih di bawah batas 50.

#### 3.3.3 Parameter built-in — tidak perlu Custom Definition

GA4 sudah menangani parameter ini secara native (terutama pada `page_view`):

| Parameter       | Dipakai di                                   |
| --------------- | -------------------------------------------- |
| `page_path`     | `page_view`, `view_article`                  |
| `page_location` | `page_view`, `view_article`, `ad_impression` |
| `page_title`    | `page_view`, `view_article`                  |

Jangan daftarkan sebagai Custom Dimension kecuali ingin memakainya di event non-pageview dengan laporan khusus.
