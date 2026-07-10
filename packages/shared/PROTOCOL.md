# QuizStrike Client Protocol

The backend remains authoritative for session validation, nickname validation, team assignment, quiz correctness, money, purchases, alive/eliminated state, tag validation, round state, and scoreboard state.

## HTTP API Used By The Browser Arena

### Join

`POST /api/sessions/:code/join`

Request:

```json
{ "nickname": "StudentName" }
```

Response:

```json
{
  "session": "GameSession",
  "player": "PlayerSession",
  "playerToken": "secret",
  "question": "PublicQuestion"
}
```

### Request Question

`GET /api/sessions/:code/players/:playerId/question`

Header:

```text
X-Player-Token: secret
```

### Submit Answer

`POST /api/sessions/:code/players/:playerId/answer`

Header:

```text
X-Player-Token: secret
```

Request:

```json
{ "questionId": "question-id", "selectedChoice": "A" }
```

### Buy Gear

`POST /api/sessions/:code/players/:playerId/buy`

Header:

```text
X-Player-Token: secret
```

Request:

```json
{ "gearId": "quick_blaster" }
```

The server confirms the player is alive, has enough money, and is inside their own team base before changing gear. Snowball packs can be bought anywhere on the map so students can stay in the learning/action loop.

## Socket.IO Events

Client-to-server events:

- `join_session_room`
- `player_position`
- `fire_action`

Server-to-client events:

- `session_state`
- `quiz_result`
- `damage_result`
- `elimination_update`
- `error_message`

## Current Socket.IO Mapping

- `join_session_room` subscribes the browser arena to a session room.
- `session_state` delivers the teacher roster, student roster, round state, scoreboard, and current player state.
- `player_position` publishes a player's live arena position. The payload must include `code`, `playerId`, `playerToken`, `x`, `z`, and `facing`.
- `fire_action` requests authoritative tag validation. The payload must include `code`, `playerId`, `playerToken`, `x`, `z`, and `facing`.
- `quiz_result` includes answer correctness and authoritative player money.
- `damage_result` reports validated tag damage.
- `elimination_update` reports validated eliminations and tag bonus money.

The browser may show immediate visual effects, but health, elimination, money, and score must only change from server state or result events.
