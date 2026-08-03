# Freeze streak announcements

Freeze streaks are owned by the server and stored on the live `PlayerSession` only. A streak increases after a server-validated elimination (including a Zombie conversion, because the existing game rules award that tag credit) and resets on any validated hit against the streaking player, round reset, team change, removal, or disconnect after the existing reconnect grace period.

Bots count because the current authoritative combat path awards tag and score credit for bot eliminations. They are excluded from teacher learning-report rows, but not from live gameplay scoring. This preserves the existing scoring rule while keeping client-submitted streak values out of the protocol.

Only thresholds 3 through 8 emit announcements. A streak above 8 does not repeat the Godlike callout until the streak is reset and reaches 8 again.
