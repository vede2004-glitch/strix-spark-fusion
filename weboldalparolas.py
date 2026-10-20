import json
import re
import os
import time
import calendar
import hashlib
import requests
import feedparser
import torch
import numpy as np
from datetime import datetime
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor
from sentence_transformers import SentenceTransformer
from transformers import pipeline

# ==============================================================================
# 1. KONFIGURÁCIÓ
# ==============================================================================
RSS_FEEDS = {
    "Maszol": "https://maszol.ro/rss",
    "Maszol Sport": "https://maszol.ro/sport/rss",
    "Maszol Gazdaság": "https://maszol.ro/gazdasag/rss",
    "Maszol Életmód": "https://maszol.ro/eletmod/rss",

    "Transtelex": "https://transtelex.ro/rss",
    "Átlátszó Erdély": "https://atlatszo.ro/feed/",
    "Udvarhelyi Hírportál (UH.ro)": "https://www.uh.ro/feed/",
    "Kolozsvári Rádió (HU)": "https://www.kolozsvariradio.ro/feed/",
    "Vásárhely.ma": "https://www.vasarhely.ma/feed/",
    "Marosvásárhelyi Rádió (HU)": "https://www.marosvasarhelyiradio.ro/feed/",
    "Mediatica.ro": "https://www.mediatica.ro/feed/",

    "Szatmári sporthírek": "https://szmsport.ro/feed/",
    "Manna": "https://manna.ro/feed/",
    "RomKat": "https://romkat.ro/feed/",
    "Hargita Népe": "https://hargitanepe.ro/rss",

    "Agerpres (HU)": "https://www.agerpres.ro/magyar/rss",

    "GSP - Gazeta Sporturilor": "https://www.gsp.ro/rss.xml",

    "Economedia": "https://economedia.ro/feed",
    "Ziarul Financiar": "https://www.zf.ro/rss",

    "Cancan.ro": "https://www.cancan.ro/feed",

    "PresaSM (Szatmár)": "https://www.presasm.ro/feed/",

    "Go4IT": "https://www.go4it.ro/feed/",
    "Zonait.ro": "https://zonait.ro/feed/",

    "Digi24": "https://www.digi24.ro/rss",
    "G4Media": "https://www.g4media.ro/feed",
    "HotNews.ro": "https://www.hotnews.ro/rss",
    "Adevărul": "https://adevarul.ro/rss/",
    "Mediafax": "https://www.mediafax.ro/rss/",
    "ProTV Stiri": "https://stirileprotv.ro/rss",
    "Ebihoreanul (Nagyvárad/Bihar)": "https://www.ebihoreanul.ro/rss"
}

MEMORY_FILE = "erdelyi_hirek_memoria.json"
GROUPED_FILE = "erdelyi_hirek_csoportositott.json"
ARCHIVE_FILE = "erdelyi_hirek_archivum.json"  # 🛑 Megtartva a meglévő frontendhez
OUTPUT_FILE = "src/data/news.json"

SIMILARITY_THRESHOLD_CROSS_SOURCE = 0.72
SIMILARITY_THRESHOLD_SAME_SOURCE = 0.80

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

CATEGORIES = {
    "Sport": ["foci", "labdarúgás", "mérkőzés", "bajnokság", "edző", "győzelem", "vereség", "liga", "kupa", "meccs", "gól", "kézilabda", "kosárlabda", "jégkorong", "hoki", "fotbal", "meci", "campionat"],
    "Politika": ["kormány", "parlament", "választás", "párt", "politika", "tanács", "polgármester", "miniszter", "szenátus", "döntés", "törvény", "rmdsz", "psd", "pnl", "usr", "aur", "guvern", "alegeri", "primar"],
    "Gazdaság": ["pénz", "euró", "lej", "infláció", "befektetés", "gazdaság", "cégek", "üzlet", "piac", "drágulás", "árak", "bank", "fizetés", "bér", "bani", "inflatie", "investitii", "economie"],
    "Kultúra": ["színház", "múzeum", "koncert", "kiállítás", "könyv", "irodalom", "zene", "művészet", "fesztivál", "egyház", "teatru", "muzeu", "carte", "muzica", "biserica"],
    "Erdély": ["erdély", "székelyföld", "kolozsvár", "marosvásárhely", "csíkszereda", "sepsiszentgyörgy", "székelyudvarhely", "nagyvárad", "szatmárnémeti", "brassó", "hargita", "kovászna", "maros"],
    "Bulvár": ["sztár", "celeb", "szerelem", "szakítás", "házasság", "botrány", "vedeta", "scandal", "divort", "cancan", "showbiz", "horoszkóp"]
}

_MODEL = None
_ZERO_SHOT_CLASSIFIER = None

def get_model():
    global _MODEL
    if _MODEL is None:
        print("🧠 SentenceTransformer AI modell betöltése...")
        _MODEL = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        _MODEL.to(torch.float32)  # 👈 Kényszerített float32 típus a típuseltérési hiba megelőzésére
    return _MODEL

def get_zero_shot_classifier():
    global _ZERO_SHOT_CLASSIFIER
    if _ZERO_SHOT_CLASSIFIER is None:
        print("🏷️ Ingyenes Zero-Shot AI kategória-osztályozó betöltése...")
        _ZERO_SHOT_CLASSIFIER = pipeline("zero-shot-classification", model="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli")
    return _ZERO_SHOT_CLASSIFIER

# ==============================================================================
# 2. SEGÉDFUNKCIÓK ÉS KATEGÓRIA OSZTÁLYOZÓ
# ==============================================================================
def parse_published_time(entry) -> int:
    pub_parsed = entry.get('published_parsed') or entry.get('updated_parsed')
    if pub_parsed:
        try:
            return int(calendar.timegm(pub_parsed))
        except Exception:
            pass

    raw_date = entry.get('published') or entry.get('updated') or entry.get('pubDate')
    if raw_date:
        try:
            dt = parsedate_to_datetime(raw_date)
            return int(dt.timestamp())
        except Exception:
            pass

    link = entry.get('link', '')
    url_date_match = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', link) or re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', link)
    if url_date_match:
        try:
            parts = url_date_match.groups()
            if len(parts[0]) == 4:
                dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            else:
                dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            return int(dt.timestamp())
        except Exception:
            pass

    return 0

def load_json_file(filename):
    if os.path.exists(filename):
        try:
            with open(filename, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_json_file(filename, data):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def clean_text(text):
    if not text:
        return ""
    text = BeautifulSoup(text, 'html.parser').text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def classify_article_fast(title, summary, source_name):
    """ Gyors, szálbiztos szabályalapú kategorizálás (AI hívás nélkül) """
    text = f"{title} {summary}".lower()

    # 1. Bűnügyi, Iskolai hírek
    crime_education_keywords = [
        "rendőrség", "bántalmazás", "letartóztatás", "bíróság", "miniszter", 
        "iskola", "profesor", "politie", "dosar penal", "reţinut", "agresat", "tanár"
    ]
    if any(kw in text for kw in crime_education_keywords):
        if any(w in text for w in ["erdély", "timișoara", "temesvár", "kolozsvár", "marosvásárhely", "székelyföld"]):
            return "Erdély"
        return "Általános"

    # 2. Forrás-alapú besorolások
    if source_name in ["Szatmári sporthírek", "Székely Sport", "Maszol Sport", "GSP - Gazeta Sporturilor"]:
        return "Sport"
    if source_name in ["Maszol Gazdaság", "Economedia", "Ziarul Financiar"]:
        return "Gazdaság"
    if source_name in ["Click.ro", "Cancan.ro", "Maszol Életmód"]:
        return "Bulvár"
    if source_name in ["Udvarhelyi Hírportál (UH.ro)", "Hargita Népe", "PresaSM (Szatmár)", "Szatmári Friss Újság", "Vásárhely.ma", "Átlátszó Erdély", "Ebihoreanul (Nagyvárad/Bihar)"]:
        return "Erdély"
    if source_name in ["Go4IT", "Zonait.ro"]:
        return "Általános"

    # 3. Gyors kulcsszavas ellenőrzés
    real_sport_keywords = [
        "foci", "labdarúgás", "mérkőzés", "bajnokság", "gól", "kupa", "meccs", 
        "kézilabda", "kosárlabda", "jégkorong", "hoki", "fotbal", "meci", "campionat"
    ]
    if any(kw in text for kw in real_sport_keywords):
        return "Sport"

    for category, keywords in CATEGORIES.items():
        if category == "Sport":
            continue
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text):
                return category

    return "Általános"

def extract_cover_image(entry, article_url, session):
    if 'media_content' in entry and entry.media_content:
        for media in entry.media_content:
            if 'url' in media and media['url']:
                return media['url']
    if 'links' in entry:
        for link in entry.links:
            if link.get('type', '').startswith('image/') and 'href' in link:
                return link['href']
    raw_html = entry.get('summary', '') or entry.get('description', '')
    if raw_html:
        soup = BeautifulSoup(raw_html, 'html.parser')
        img = soup.find('img')
        if img and img.get('src'):
            return img['src']

    return ""

def get_embedding(title, summary):
    clean_title = clean_text(title)
    clean_sum = clean_text(summary)[:250]
    text_to_embed = f"{clean_title}. {clean_title}. {clean_sum}"
    if not text_to_embed.strip():
        return []
    model_inst = get_model()
    embedding = model_inst.encode(text_to_embed, convert_to_numpy=True)
    return np.round(embedding, 4).tolist()

def cosine_similarity(v1, v2):
    if not v1 or not v2:
        return 0.0
    a, b = np.array(v1), np.array(v2)
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def extract_article_data(entry, source_name, session, cutoff_24h):
    title = clean_text(entry.get('title', ''))
    link = entry.get('link', '').strip()

    pub_timestamp = parse_published_time(entry)
    current_now = int(time.time())

    if pub_timestamp > current_now:
        pub_timestamp = current_now

    if pub_timestamp == 0 or pub_timestamp < cutoff_24h:
        return None

    raw_summary = entry.get('summary', '') or entry.get('description', '')
    clean_summary = clean_text(raw_summary)
    image_url = extract_cover_image(entry, link, session)
    
    # ⚡ Gyors osztályozás hívása a párhuzamos szálban
    category = classify_article_fast(title, clean_summary, source_name)

    return {
        "source": source_name,
        "title": title,
        "link": link,
        "summary": clean_summary,
        "image": image_url,
        "published_at": pub_timestamp,
        "category": category
    }

def fetch_single_feed(item_and_cutoff):
    (source_name, feed_url), cutoff_24h = item_and_cutoff
    extracted = []
    session = requests.Session()
    session.headers.update(HEADERS)
    try:
        response = session.get(feed_url, timeout=20, allow_redirects=True)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        for entry in feed.entries:
            art = extract_article_data(entry, source_name, session, cutoff_24h)
            if art and art["title"]:
                extracted.append(art)
    except Exception as e:
        print(f"⚠️ Hiba a(z) {source_name} feed beolvasásakor: {e}")
    return extracted

# ==============================================================================
# 3. CSOPORTOSÍTÁS, ARCHÍVUM MENTÉS ÉS GYORSHÍR KIMENTÉS A NEWS.JSON-BA
# ==============================================================================
def run_pipeline():
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now_str}] 🔄 Hírcsatornák frissítése indult ({len(RSS_FEEDS)} forrás)...")

    cutoff_24h = int(time.time()) - (24 * 3600)
    memory = load_json_file(MEMORY_FILE)
    archive = load_json_file(ARCHIVE_FILE)

    fetched_articles = []
    feed_items = [((src, url), cutoff_24h) for src, url in RSS_FEEDS.items()]
    
    # 1. PÁRHUZAMOS RSS LETÖLTÉS (Már AI nélkül, 100% golyóálló)
    with ThreadPoolExecutor(max_workers=len(RSS_FEEDS)) as executor:
        results = executor.map(fetch_single_feed, feed_items)

    for article_list in results:
        fetched_articles.extend(article_list)

    # 2. BIZONYTALAN ("Általános") CIKKEK AI OSZTÁLYOZÁSA EGYETLEN SZÁLON
    general_articles = [a for a in fetched_articles if a["category"] == "Általános"]
    if general_articles:
        print(f"🤖 AI kategória-pontosítás {len(general_articles)} db általános cikken...")
        classifier = get_zero_shot_classifier()
        candidate_labels = ["Politika", "Sport", "Gazdaság", "Bulvár", "Kultúra", "Erdély", "Általános"]
        
        for art in general_articles:
            text = f"{art['title']}. {art['summary']}"[:500]
            try:
                res = classifier(text, candidate_labels)
                art["category"] = res['labels'][0]
            except Exception:
                pass

    # 3. EMBEDDING ÉS DEDUPLIKÁCIÓ
    for art in fetched_articles:
        existing_item = next((m for m in memory if m["link"] == art["link"]), None)
        if existing_item:
            if art["published_at"] > existing_item.get("fetched_at", 0):
                existing_item["title"] = art["title"]
                existing_item["summary"] = art["summary"]
                existing_item["fetched_at"] = art["published_at"]
                if art["image"]:
                    existing_item["image"] = art["image"]
            continue

        art_embedding = get_embedding(art['title'], art['summary'])
        if not art_embedding:
            continue

        best_match_group_id = None
        highest_similarity = -1.0
        best_match_source = ""

        for m_item in memory:
            if "embedding" not in m_item or not m_item["embedding"]:
                m_item["embedding"] = get_embedding(m_item['title'], m_item.get('summary', ''))

            sim = cosine_similarity(art_embedding, m_item["embedding"])
            if sim > highest_similarity:
                highest_similarity = sim
                best_match_group_id = m_item["group_id"]
                best_match_source = m_item["source"]

        required_threshold = SIMILARITY_THRESHOLD_SAME_SOURCE if art["source"] == best_match_source else SIMILARITY_THRESHOLD_CROSS_SOURCE

        if highest_similarity >= required_threshold and best_match_group_id:
            group_id = best_match_group_id
        else:
            link_hash = hashlib.md5(art["link"].encode("utf-8")).hexdigest()[:10]
            group_id = f"group_{link_hash}"

        memory.append({
            "group_id": group_id,
            "source": art["source"],
            "title": art["title"],
            "link": art["link"],
            "image": art["image"],
            "summary": art["summary"],
            "category": art["category"],
            "embedding": art_embedding,
            "fetched_at": art["published_at"]
        })

    # 📦 ARCHÍVUM KEZELÉS: A 24 óránál régebbi cikkek átkerülnek az erdelyi_hirek_archivum.json-ba
    fresh_memory = []
    archive_updated = False
    existing_archive_links = {a["link"] for a in archive}

    for item in memory:
        if item.get("fetched_at", 0) >= cutoff_24h:
            fresh_memory.append(item)
        else:
            if item["link"] not in existing_archive_links:
                clean_arch_item = {k: v for k, v in item.items() if k != "embedding"}
                archive.append(clean_arch_item)
                existing_archive_links.add(item["link"])
                archive_updated = True

    save_json_file(MEMORY_FILE, fresh_memory)
    if archive_updated:
        save_json_file(ARCHIVE_FILE, archive)
        print(f"📦 Archívum frissítve! Összesen {len(archive)} cikk az erdelyi_hirek_archivum.json fájlban.")

    # 💾 CSOPORTOSÍTOTT MEMÓRIA MENTÉSE
    grouped_dictionary = {}
    for item in fresh_memory:
        g_id = item["group_id"]
        clean_item = {
            "source": item["source"],
            "title": item["title"],
            "link": item["link"],
            "image": item["image"],
            "summary": item["summary"],
            "category": item["category"],
            "published_at": item["fetched_at"]
        }
        if g_id not in grouped_dictionary:
            grouped_dictionary[g_id] = {
                "group_id": g_id,
                "category": item["category"],
                "articles_count": 0,
                "articles": []
            }
        grouped_dictionary[g_id]["articles"].append(clean_item)
        grouped_dictionary[g_id]["articles_count"] += 1

    save_json_file(GROUPED_FILE, list(grouped_dictionary.values()))

    # ⚡ VÉGSŐ GYORSHÍR KIÍRÁS A SRC/DATA/NEWS.JSON-BA
    os.makedirs("src/data", exist_ok=True)
    fresh_news = {}

    for item in fresh_memory:
        g_id = item.get("group_id")
        pub_time = int(item.get("fetched_at", 0))

        if g_id not in fresh_news:
            fresh_news[g_id] = {
                "group_id": g_id,
                "category": item.get("category", "Általános"),
                "image": item.get("image", ""),
                "is_synthesized": False,
                "sources": [{"source": item.get("source"), "title": item.get("title"), "link": item.get("link")}],
                "published_at": pub_time,
                "title_hu": item.get("title", ""),
                "lead_hu": item.get("summary", "")[:200] + "..." if item.get("summary") else "",
                "content_hu": item.get("summary", ""),
                "title_ro": item.get("title", ""),
                "lead_ro": item.get("summary", "")[:200] + "..." if item.get("summary") else "",
                "content_ro": item.get("summary", "")
            }

    raw_list = list(fresh_news.values())
    raw_list.sort(key=lambda x: x.get("published_at", 0), reverse=True)

    # 🛑 FORRÁS-DIVERZITÁS
    balanced_list = []
    skipped_items = []

    for item in raw_list:
        item_source = item.get("sources", [{}])[0].get("source")
        if (
            len(balanced_list) >= 2 
            and balanced_list[-1].get("sources", [{}])[0].get("source") == item_source
            and balanced_list[-2].get("sources", [{}])[0].get("source") == item_source
        ):
            skipped_items.append(item)
        else:
            balanced_list.append(item)

    final_list = balanced_list + skipped_items

    save_json_file(OUTPUT_FILE, final_list)
    print(f"⚡ 5 perces gyorshír frissítés kész! ({len(final_list)} cikk a news.json-ban)")

if __name__ == "__main__":
    run_pipeline()
