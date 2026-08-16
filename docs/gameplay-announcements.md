# Gameplay announcement assets

The centralized `GameplayAnnouncementManager` loads these exact voiceover paths:

- `/assets/audio/announcements/flag-planted.mp3` — “The flag has been planted.”
- `/assets/audio/announcements/streak-heating-up.mp3` — “He's heating up!”
- `/assets/audio/announcements/streak-dominating.mp3` — “Dominating!”
- `/assets/audio/announcements/streak-unstoppable.mp3` — “Unstoppable!”
- `/assets/audio/announcements/streak-wicked-sick.mp3` — “Wicked Sick!”
- `/assets/audio/announcements/streak-monster.mp3` — “Muh-Muh-Muh-Monster!”
- `/assets/audio/announcements/streak-godlike.mp3` — “Guh-Guh-Guh-Godlike!”

These files are bundled in `apps/web/public/assets/audio/announcements`. The
manager preloads them when sound is enabled and falls back to the existing
synthetic `GameAudio` cue if a file is missing, blocked by autoplay policy, or
fails to decode. Queue size is bounded at four items; flag planting has higher
priority than streak callouts. Master mute and SFX volume preferences are shared
with the existing game audio settings, and leaving the student match clears the
queue and stops the active browser audio element.
