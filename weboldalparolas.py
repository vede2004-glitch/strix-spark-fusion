import json
import re
import os
import time
import requests
import feedparser
import numpy as np
from datetime import datetime
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor
from sentence_transformers import SentenceTransformer

# ==============================================================================
# 1. KONFIGURÁCIÓ
# ==============================================================================
RSS_FEEDS = {
    # --- MAGYAR ERDÉLYI FORRÁSOK ---
    "Maszol": "https://maszol.ro/rss",
    "Maszol Sport": "https://maszol.ro/sport/rss",
    "Maszol Gazdaság": "https://maszol.ro/gazdasag/rss",
    "Maszol Életmód": "https://maszol.ro/eletmod/rss",
    "Székely Sport": "https://www.szekelysport.ro/rss",
    "Transtelex": "https://transtelex.ro/rss",
    "Átlátszó Erdély": "https://atlatszo.ro/feed/",
    "Udvarhelyi Hírportál (UH.ro)": "https://www.uh.ro/feed/",
    "Kolozsvári Rádió (HU)": "https://www.kolozsvariradio.ro/feed/",
    "Vásárhely.ma": "https://www.vasarhely.ma/feed/",
    "Marosvásárhelyi Rádió (HU)": "https://www.marosvasarhelyiradio.ro/feed/",
    "Mediatica.ro": "https://www.mediatica.ro/feed/",

}

MEMORY_FILE = "erdelyi_hirek_memoria.json"
GROUPED_FILE = "erdelyi_hirek_csoportositott.json"

LOOKBACK_HOURS = 48

SIMILARITY_THRESHOLD_CROSS_SOURCE = 0.72
SIMILARITY_THRESHOLD_SAME_SOURCE = 0.80

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

CATEGORIES = {
    "Sport": [
        "foci", "labdarúgás", "mérkőzés", "bajnokság", "edző", "győzelem", "vereség", 
        "liga", "kupa", "meccs", "gól", "kézilabda", "kosárlabda", "párbajtőr", "judo", 
        "jégkorong", "hoki", "fotbal", "meci", "campionat", "echipa", "sport", "simona halep"
    ],
    "Politika": [
        "kormány", "parlament", "választás", "párt", "politika", "tanács", "polgármester", 
        "miniszter", "szenátus", "döntés", "törvény", "rmdsz", "psd", "pnl", "usr", "aur", 
        "guvern", "alegeri", "partid", "primar", "lege", "ministru", "senat"
    ],
    "Gazdaság": [
        "pénz", "euró", "lej", "infláció", "befektetés", "gazdaság", "cégek", "üzlet", 
        "piac", "drágulás", "árak", "adag", "bank", "fizetés", "bér", "fogyasztás", 
        "bani", "inflatie", "investitii", "economie", "preturi", "pret", "fisc", "buget"
    ],
    "Kultúra": [
        "színház", "múzeum", "koncert", "kiállítás", "könyv", "irodalom", "zene", "művészet", 
        "fesztivál", "egyház", "vallás", "pápa", "misé", "teatru", "muzeu", "carte", "muzica", "biserica", "cultura"
    ],
    "Közélet": [
        "iskola", "egészségügy", "kórház", "utazás", "időjárás", "útlezárás", "diák", 
        "egyenruha", "scoala", "spital", "elevi", "trafic", "vremea", "oktatás",
        "baleset", "rendőrség", "mentők", "rendőr", "katasztrófa", "tűzoltók", "gyilkosság", 
        "rablás", "letartóztatás", "accident", "politie", "pompieri", "incendiu", "crima", "arestat"
    ],
    "Bulvár": [
        "sztár", "celeb", "szerelem", "szakítás", "házasság", "botrány", "fotó", "videó", 
        "vedeta", "scandal", "divort", "relatie", "cancan", "showbiz", "monden", "horoszkóp"
    ]
}

# Globális modell változó (lusta betöltéshez)
_MODEL = None

def get_model():
    global _MODEL
    if _MODEL is None:
        print("🧠 SentenceTransformer AI modell betöltése...")
        _MODEL = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _MODEL

# ==============================================================================
# 2. SEGÉDFUNKCIÓK
# ==============================================================================
def load_memory():
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_memory(memory_data):
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memory_data, f, ensure_ascii=False, indent=2)

def clean_old_memory(memory_data):
    current_time = time.time()
    max_age_seconds = LOOKBACK_HOURS * 3600
    return [art for art in memory_data if (current_time - art.get("fetched_at", current_time)) < max_age_seconds]

def clean_text(text):
    if not text:
        return ""
    text = BeautifulSoup(text, 'html.parser').text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def classify_article(title, summary, source_name, entry_tags):
    if source_name in ["Szatmári sporthírek", "Székely Sport", "Maszol Sport", "GSP - Gazeta Sporturilor"]:
        return "Sport"
        
    if source_name in ["Maszol Gazdaság", "Economedia", "Ziarul Financiar"]:
        return "Gazdaság"

    if source_name in ["Click.ro", "Cancan.ro", "Maszol Életmód"]:
        return "Bulvár"

    if source_name in ["PresaSM (Szatmár)"]:
        return "Közélet"

    if source_name in ["Go4IT", "Zonait.ro"]:
        return "Általános"

    if source_name in ["Agerpres (Politica)"]:
        return "Politika"

    if entry_tags:
        tags_text = " ".join([t.lower() for t in entry_tags])
        
        if any(w in tags_text for w in ["sport", "fotbal", "foci", "meci"]):
            return "Sport"
        if any(w in tags_text for w in ["politica", "politikai", "alegeri", "guvern"]):
            return "Politika"
        if any(w in tags_text for w in ["economie", "gazdasag", "bani", "business"]):
            return "Gazdaság"
        if any(w in tags_text for w in ["cultura", "kultura", "arte", "teatru"]):
            return "Kultúra"
        if any(w in tags_text for w in ["monden", "cancan", "showbiz", "eletmod", "bulvar"]):
            return "Bulvár"
        if any(w in tags_text for w in ["social", "kozelet", "eveniment", "accident", "politie"]):
            return "Közélet"

    text = f"{title} {summary}".lower()
    
    for category, keywords in CATEGORIES.items():
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

    if article_url:
        try:
            res = session.get(article_url, timeout=4)
            if res.status_code == 200:
                soup = BeautifulSoup(res.content, 'html.parser')
                og_img = soup.find('meta', property='og:image') or soup.find('meta', attrs={'name': 'og:image'})
                if og_img and og_img.get('content'):
                    return og_img['content']
        except Exception:
            pass

    return "https://via.placeholder.com/600x400?text=Nincs+Kep"

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
    a = np.array(v1)
    b = np.array(v2)
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def extract_article_data(entry, source_name, session):
    title = clean_text(entry.get('title', ''))
    link = entry.get('link', '').strip()
    
    raw_summary = entry.get('summary', '') or entry.get('description', '')
    if 'content' in entry and entry.content and not raw_summary:
        raw_summary = entry.content[0].get('value', '')
        
    clean_summary = clean_text(raw_summary)
    image_url = extract_cover_image(entry, link, session)

    pub_parsed = entry.get('published_parsed') or entry.get('updated_parsed')
    pub_timestamp = time.mktime(pub_parsed) if pub_parsed else time.time()

    entry_tags = []
    if 'tags' in entry and entry.tags:
        entry_tags = [t.get('term', '') for t in entry.tags if t.get('term')]

    category = classify_article(title, clean_summary, source_name, entry_tags)

    return {
        "source": source_name,
        "title": title,
        "link": link,
        "summary": clean_summary,
        "image": image_url,
        "published_at": pub_timestamp,
        "category": category
    }

# ==============================================================================
# 3. CSOPORTOSÍTÁSI & FÁJLBA MENTÉSI LOGIKA
# ==============================================================================
def fetch_single_feed(item):
    source_name, feed_url = item
    extracted = []
    
    session = requests.Session()
    session.headers.update(HEADERS)
    
    try:
        response = session.get(feed_url, timeout=20, allow_redirects=True)
        response.raise_for_status()
        feed = feedparser.parse(response.content)

        for entry in feed.entries:
            art = extract_article_data(entry, source_name, session)
            if art["title"]:
                extracted.append(art)
    except Exception as e:
        print(f"⚠️ Hiba a(z) {source_name} feed beolvasásakor: {e}")
    return extracted

def run_pipeline():
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now_str}] 🔄 Hírcsatornák frissítése indult ({len(RSS_FEEDS)} forrás)...")

    memory = load_memory()
    memory = clean_old_memory(memory)

    fetched_articles = []
    with ThreadPoolExecutor(max_workers=len(RSS_FEEDS)) as executor:
        results = executor.map(fetch_single_feed, RSS_FEEDS.items())

    for article_list in results:
        fetched_articles.extend(article_list)

    current_time = time.time()
    max_age_seconds = LOOKBACK_HOURS * 3600
    
    new_topics_count = 0
    grouped_articles_count = 0

    for art in fetched_articles:
        if (current_time - art["published_at"]) > max_age_seconds:
            continue

        if any(m["link"] == art["link"] for m in memory):
            continue

        art_embedding = get_embedding(art['title'], art['summary'])
        if not art_embedding:
            continue

        best_match_group_id = None
        highest_similarity = -1.0
        best_match_source = ""
        matched_title = ""

        for m_item in memory:
            if "embedding" not in m_item or not m_item["embedding"]:
                m_item["embedding"] = get_embedding(m_item['title'], m_item.get('summary', ''))

            sim = cosine_similarity(art_embedding, m_item["embedding"])
            if sim > highest_similarity:
                highest_similarity = sim
                best_match_group_id = m_item["group_id"]
                best_match_source = m_item["source"]
                matched_title = m_item["title"]

        required_threshold = (
            SIMILARITY_THRESHOLD_SAME_SOURCE 
            if art["source"] == best_match_source 
            else SIMILARITY_THRESHOLD_CROSS_SOURCE
        )

        if highest_similarity >= required_threshold and best_match_group_id:
            group_id = best_match_group_id
            grouped_articles_count += 1
            print(f"🔥 PÁROSÍTVA [{art['source']} <-> {best_match_source}] ({highest_similarity:.2f}):\n   • Új: {art['title'][:60]}...\n   • Meglévő: {matched_title[:60]}...")
        else:
            group_id = f"group_{int(time.time())}_{len(memory) + 1}"
            new_topics_count += 1

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

    save_memory(memory)

    grouped_dictionary = {}
    for item in memory:
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

    final_grouped_list = list(grouped_dictionary.values())

    with open(GROUPED_FILE, "w", encoding="utf-8") as f:
        json.dump(final_grouped_list, f, ensure_ascii=False, indent=2)

    multi_groups = sum(1 for g in final_grouped_list if g["articles_count"] > 1)
    single_groups = sum(1 for g in final_grouped_list if g["articles_count"] == 1)

    print("\n" + "=" * 60)
    print(f"✅ FELDOLGOZÁS KÉSZ!")
    print(f"📁 Kimeneti JSON: '{GROUPED_FILE}' ({len(final_grouped_list)} téma összesen)")
    print(f"   • Több forrásból származó, összevont hírek: {multi_groups} csoport")
    print(f"   • Egyetlen forrásból származó egyedi hírek: {single_groups} csoport")
    print("=" * 60 + "\n")

# ==============================================================================
# 4. FUTTATÁS (GitHub Actions-re optimalizálva)
# ==============================================================================
if __name__ == "__main__":
    run_pipeline()