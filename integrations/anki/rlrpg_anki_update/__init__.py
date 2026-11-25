import json
import re
import threading
import time
import urllib.request
from pathlib import Path

from aqt import gui_hooks, mw
from aqt.utils import tooltip


LANGUAGE_FIELDS = {"language", "targetlanguage", "target language", "lang"}
_queue_lock = threading.Lock()
_state_lock = threading.Lock()
_pending = []
_seen_review_ids = set()
_state_loaded = False
_state_profile = None


def _config():
    return mw.addonManager.getConfig(__name__) or {}


def _api_url(config):
    return config.get("api_url", "http://localhost:3000").rstrip("/")


def _request(path, config, payload=None, idempotency_key=None):
    token = config.get("api_key", "").strip()
    if not token:
        raise RuntimeError("Add your RLRPG writer key in the add-on config.")
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": "Bearer " + token}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    request = urllib.request.Request(_api_url(config) + path, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def _normalize(value):
    return re.sub(r"[^a-z]", "", value.casefold())


def _detect_language(note, config):
    language_map = config.get("language_to_skill_code", {})
    normalized_map = {_normalize(name): (name, code) for name, code in language_map.items()}
    fields = {name.casefold(): str(value) for name, value in note.items()}
    normalized_field_names = {_normalize(item) for item in LANGUAGE_FIELDS}
    for key, value in fields.items():
        if _normalize(key) in normalized_field_names:
            match = normalized_map.get(_normalize(value.strip()))
            if match:
                return match
    for tag in note.tags:
        match = re.search(r"(?:^|::)(?:language|lang)::?([a-z -]+)$", tag, re.I)
        if match:
            language = normalized_map.get(_normalize(match.group(1)))
            if language:
                return language
        language = normalized_map.get(_normalize(tag))
        if language:
            return language

    text = " ".join(fields.values()) + " " + " ".join(note.tags)
    if re.search(r"[\uac00-\ud7af]", text):
        return normalized_map.get("korean")
    if re.search(r"[\u3040-\u30ff]", text):
        return normalized_map.get("japanese")
    if re.search(r"[\u4e00-\u9fff]", text):
        return normalized_map.get("chinese")
    return None


def _profile_path(filename):
    return Path(mw.pm.profileFolder()) / filename


def _save_queue():
    _profile_path("rlrpg_anki_queue.json").write_text(
        json.dumps(_pending, ensure_ascii=False), encoding="utf-8"
    )


def _load_queue():
    global _pending
    try:
        _pending = json.loads(
            _profile_path("rlrpg_anki_queue.json").read_text(encoding="utf-8")
        )
    except (OSError, ValueError):
        _pending = []


def _save_state():
    _profile_path("rlrpg_anki_state.json").write_text(
        json.dumps({"seen_review_ids": sorted(_seen_review_ids)}), encoding="utf-8"
    )


def _load_state():
    global _seen_review_ids, _state_loaded, _state_profile
    profile = str(mw.pm.profileFolder())
    if _state_loaded and _state_profile == profile:
        return
    try:
        state = json.loads(
            _profile_path("rlrpg_anki_state.json").read_text(encoding="utf-8")
        )
        _seen_review_ids = {str(item) for item in state.get("seen_review_ids", [])}
    except (OSError, ValueError):
        _seen_review_ids = {
            str(row[0]) for row in mw.col.db.all("SELECT id FROM revlog")
        }
        _save_state()
    _state_loaded = True
    _state_profile = profile


def _send_event(event):
    config = _config()
    settings = _request("/api/v1/automation/anki-settings", config)
    xp = settings["newCardXp"] if event["is_new"] else settings["reviewXp"]
    if xp <= 0:
        _remove_pending(event["idempotency_key"])
        return
    payload = {
        "skillCode": event["skill_code"],
        "xp": xp,
        "activity": "Anki new card" if event["is_new"] else "Anki review",
        "notes": event["notes"],
        "date": event["date"],
    }
    _request("/api/v1/automation/xp-entries", config, payload, event["idempotency_key"])
    _remove_pending(event["idempotency_key"])
    mw.taskman.run_on_main(
        lambda: tooltip("RLRPG: +{} XP for {}".format(xp, event["language"]), period=2500)
    )


def _remove_pending(key):
    with _queue_lock:
        global _pending
        _pending = [item for item in _pending if item["idempotency_key"] != key]
        _save_queue()


def _enqueue(event):
    with _queue_lock:
        if not any(item["idempotency_key"] == event["idempotency_key"] for item in _pending):
            _pending.append(event)
            _save_queue()


def _send_async(event):
    def work():
        try:
            _send_event(event)
        except Exception as error:
            _enqueue(event)
            mw.taskman.run_on_main(
                lambda error=error: tooltip(
                    "RLRPG Anki: {}. It will retry next time.".format(error), period=5000
                )
            )

    threading.Thread(target=work, daemon=True).start()


def _retry_pending():
    _load_queue()
    with _queue_lock:
        events = list(_pending)
    for event in events:
        _send_async(event)


def _record_review(review_id, card, ease, is_new, persist_seen=True):
    review_key = str(review_id)
    _load_state()
    with _state_lock:
        if review_key in _seen_review_ids:
            return
        _seen_review_ids.add(review_key)
        if persist_seen:
            _save_state()

    if ease < 2:
        return
    try:
        note = card.note()
        config = _config()
        detected = _detect_language(note, config)
        if detected is None:
            mw.taskman.run_on_main(
                lambda: tooltip(
                    "RLRPG Anki couldn't identify this card's language; add a Language field or tag.",
                    period=5000,
                )
            )
            return
        language, skill_code = detected
        if not skill_code:
            return
        deck_name = mw.col.decks.name(card.did)
        event = {
            "idempotency_key": "anki-review-" + review_key,
            "skill_code": skill_code,
            "language": language,
            "is_new": is_new,
            "date": time.strftime("%Y-%m-%d", time.localtime(int(review_id) / 1000)),
            "notes": deck_name,
        }
        _enqueue(event)
        _send_async(event)
    except Exception as error:
        with _state_lock:
            _seen_review_ids.discard(review_key)
            _save_state()
        mw.taskman.run_on_main(
            lambda error=error: tooltip(
                "RLRPG Anki could not record this card: {}".format(error), period=5000
            )
        )


def _is_first_correct_new_card_review(review_id, card_id, review_type, ease):
    if ease < 2 or review_type != 0:
        return False
    earlier_success = mw.col.db.first(
        "SELECT 1 FROM revlog WHERE cid = ? AND id < ? AND ease >= 2 LIMIT 1",
        card_id,
        review_id,
    )
    return earlier_success is None


def _on_answer(reviewer, card, ease):
    try:
        review = mw.col.db.first(
            "SELECT id, type FROM revlog WHERE cid = ? ORDER BY id DESC LIMIT 1", card.id
        )
        if review is not None:
            is_new = _is_first_correct_new_card_review(
                review[0], card.id, review[1], ease
            )
            _record_review(review[0], card, ease, is_new)
    except Exception as error:
        tooltip("RLRPG Anki could not read this review: {}".format(error), period=5000)


def _on_sync_did_finish():
    try:
        _retry_pending()
        _load_state()
        reviews = mw.col.db.all("SELECT id, cid, ease, type FROM revlog ORDER BY id")
        for review_id, card_id, ease, review_type in reviews:
            if str(review_id) in _seen_review_ids:
                continue
            try:
                card = mw.col.get_card(card_id)
            except Exception:
                with _state_lock:
                    _seen_review_ids.add(str(review_id))
                continue
            is_new = _is_first_correct_new_card_review(
                review_id, card_id, review_type, ease
            )
            _record_review(review_id, card, ease, is_new, persist_seen=False)
        with _state_lock:
            _save_state()
    except Exception as error:
        tooltip("RLRPG Anki could not check synced reviews: {}".format(error), period=5000)


def _on_profile_did_open():
    _load_state()
    _retry_pending()


gui_hooks.reviewer_did_answer_card.append(_on_answer)
gui_hooks.sync_did_finish.append(_on_sync_did_finish)
gui_hooks.profile_did_open.append(_on_profile_did_open)

