# Zeus: Daruma summit race

Zeus faces away while chanting **だるまさんがころんだ**. When his chant ends,
his head turns towards the runners and the shared signal changes to **STOP**.
Moving or starting a new jump during STOP triggers lightning and returns that
runner to the start of the previous level, keeping exactly half their remaining
movement energy. Level 1 and level 2 strikes return to the starting lane;
a level 4 strike returns to the safe checkpoint at the beginning of level 3.
Quiz answers, learning credit, and checkpoints before that level remain intact.
The first runner to physically land at the sixth checkpoint, at the summit,
defeats Zeus and ends the race. Zeus always uses a single ascent.

The opening two cycles use the slower narration. Later cycles select six
deliveries deterministically for the entire room: slow, steady, quick, a slow
start with a rushed finish, a long suspense pause, and separated rhythmic
phrases. A room-seeded shuffled bag plays every delivery once per six cycles,
rotating the order and avoiding consecutive repeats. Silence inside the chant
is still GO: students must wait for the final syllable and the STOP cue. The WAV
durations define the server's turn deadlines; there is a 1.2-second lead-in and
a 650-millisecond stopping allowance. The recordings are synthesized Japanese
speech, generated locally with `tools/audio/generate-zeus-chants.ps1`.

The head appears above the course and follows the view through its bends.
Phone layouts place it below the compact HUD; wider views place it beside the
HUD. The sky head uses a separate depth pass so scenery cannot hide the signal,
while its own depth still hides the face when turned away. GO/STOP uses words
and shapes as well as color, remains visible when a
question is open, and works without sound. Reduced motion uses an immediate
head turn. Background music is disabled in Zeus mode. Teachers can select
student-device narration or teacher-speaker narration when creating the room.
Student devices play distinct GO and STOP cues in either narration setting.

Strikes use an electrical crack and a low thunder tail, with quieter spatial
audio for other runners. Gold lightning with a purple halo and a landing ring
lasts 1.8 seconds at the struck position, even across the next GO transition.
The punished runner also sees screen-space lightning and a 2.8-second message
explaining that movement during STOP sent them back one level with half their energy.
This overlay remains visible after the instant reset and over an open question,
and never intercepts input. Reduced motion keeps the message and a stationary
world impact while removing the screen glow and lightning animation. SFX obey
the existing mute and sound-effects volume settings.

Server enforcement rejects old movement packets, including packets from earlier
chant cycles, without punishing network delay. Resetting advances the movement epoch,
rolls position, climb progress, checkpoint splits, and fall recovery back together,
and protects the runner until the next GO. Looking, answering questions,
vertical motion from an existing jump, and passive platform carry remain safe.
Ordinary falls retain the existing recovery challenge. Teacher pause suspends
the cycle and narration; resume preserves the remaining chant and gives a new
stopping allowance if Zeus was watching.

The reset lock uses the synchronized server clock. If a browser initially
blocks audio, narration retries at the live chant offset after audio is enabled.
Browsers that block mouse lock support dragging to look in Zeus mode; this
preserves the usual mouse-lock controls where they are available. Phone questions
fit without horizontal scrolling and retain a separate GO/STOP cue. Results and
standings use six checkpoints and summit progress rather than circuit laps.

Verification covers cycle timing, narration duration, head orientation and
camera placement, pause/resume, safe red-light answers and looking, lightning
resets, previous-level recovery, half-energy penalties, learning-credit preservation,
stale movement rejection, summit completion,
desktop play, and narrow portrait/landscape controls.
