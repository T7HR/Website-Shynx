"""Two Discord profiles. Run locally with `python app.py`; deploy directly to Vercel."""

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, send_from_directory

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
# Vercel serves public/ directly; this route also serves it during Python development.
app = Flask(__name__, static_folder=None)
IS_LOCAL = os.environ.get("VERCEL") != "1"
# Check saved HTML on every request locally, even with the debugger disabled.
app.config["TEMPLATES_AUTO_RELOAD"] = IS_LOCAL
_cache = {}
_cache_lock = Lock()


def configuration():
    with (ROOT / "config.json").open(encoding="utf-8") as file:
        config = json.load(file)
    if len(config.get("profiles", [])) != 2:
        raise ValueError("config.json must contain exactly two profiles")
    for profile in config["profiles"]:
        if not re.fullmatch(r"[0-9]{17,20}", profile.get("id", "")):
            raise ValueError("Discord IDs must be strings of 17–20 digits")
    return config


def request_json(url, token=None):
    headers = {"User-Agent": "SameSkyProfile/1.0", "Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bot " + token
    with urlopen(Request(url, headers=headers), timeout=5) as response:
        return json.load(response)


def avatar_url(user):
    uid = user["id"]
    avatar = user.get("avatar")
    if avatar:
        extension = "gif" if avatar.startswith("a_") else "webp"
        return f"https://cdn.discordapp.com/avatars/{uid}/{avatar}.{extension}?size=256"
    discriminator = int(user.get("discriminator") or 0)
    index = discriminator % 5 if discriminator else (int(uid) >> 22) % 6
    return f"https://cdn.discordapp.com/embed/avatars/{index}.png"


def lookup_profile(uid):
    now = time.monotonic()
    with _cache_lock:
        previous = _cache.get(uid)
        if previous and now - previous[0] < 30:
            return dict(previous[1])
    result = None
    try:
        payload = request_json(f"https://api.lanyard.rest/v1/users/{uid}")
        data = payload.get("data") or {}
        user = data.get("discord_user")
        if payload.get("success") and user and user.get("id") == uid:
            activity = next((a for a in data.get("activities", []) if a.get("type") == 4), None)
            game = next((a for a in data.get("activities", []) if a.get("type") == 0), None)
            spotify = data.get("spotify")
            detail = activity.get("state") if activity else None
            if not detail and spotify:
                detail = f"listening to {spotify.get('song', 'Spotify')}"
            if not detail and game:
                detail = f"playing {game.get('name', 'a game')}"
            result = {
                "name": user.get("global_name") or user["username"],
                "username": user["username"], "avatar": avatar_url(user),
                "status": data.get("discord_status", "offline"),
                "activity": detail or "currently doing nothing",
                "source": "lanyard", "connected": True, "stale": False,
            }
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
        pass
    token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    if result is None and token:
        try:
            user = request_json(f"https://discord.com/api/v10/users/{uid}", token)
            if user.get("id") == uid:
                result = {
                    "name": user.get("global_name") or user["username"],
                    "username": user["username"], "avatar": avatar_url(user),
                    "status": "unknown", "activity": "say hello on Discord",
                    "source": "discord", "connected": True, "stale": False,
                }
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
            pass
    if result is None and previous and previous[1].get("connected"):
        result = {**previous[1], "stale": True, "status": "unknown", "activity": "last known profile · reconnecting"}
    if result is None:
        result = {
            "name": None, "username": None, "avatar": None, "status": "unknown",
            "activity": "waiting for Discord", "source": None,
            "connected": False, "stale": False,
        }
    with _cache_lock:
        _cache[uid] = (now, result)
    return dict(result)


def complete_profile(profile):
    result = {**profile, **lookup_profile(profile["id"])}
    result["name"] = result["name"] or profile.get("fallback_name", "Discord profile")
    return result


@app.get("/")
def index():
    return render_template("index.html", config=configuration())


@app.get("/api/profiles")
def profiles():
    config = configuration()
    with ThreadPoolExecutor(max_workers=2) as pool:
        people = list(pool.map(complete_profile, config["profiles"]))
    response = jsonify({"profiles": people})
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/<path:filename>")
def public_file(filename):
    return send_from_directory(ROOT / "public", filename)


@app.after_request
def response_headers(response):
    if IS_LOCAL:
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Open http://127.0.0.1:{port} in your browser.", flush=True)
    app.run(host="127.0.0.1", port=port, debug=False)
