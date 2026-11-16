(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette = [['#197d72','#e8f4ee'],['#587a9c','#edf2f9'],['#7c749e','#f1eef8'],['#a97e32','#faf2df'],['#b2754d','#fbefe6'],['#548780','#edf6f4']];
const englishLabels = {
  "A1": "Spontaneous lexical speech",
  "A1a": "Nonword transcription",
  "A2": "Spontaneous social vocalizations",
  "A9": "Non-socially directed vocalization",
  "A4": "Echolalic repetition",
  "A5": "Fixed phrases",
  "B6": "Positive social initiation",
  "B7": "Vocal response after name mention",
  "B10": "Vocal requests",
  "B15": "Social initiation frequency",
  "B16b": "Caregiver attention bids (proxy)",
  "E2": "Negative vocalizations",
  "social:3.1": "Non-social vocalizations",
  "social:3.2": "Typical response",
  "social:3.3": "Requests",
  "social:3.4": "Attention bids",
  "social:3.5": "Showing / sharing",
  "social:3.6": "Other social initiations",
  "social:3.7": "Echolalic repetition",
  "social:3.8": "Task-related vocalizations",
  "social:3.9": "Imitation",
  "nsv:2.3": "Laughter",
  "nsv:2.4": "Other positive vocalizations",
  "nsv:2.5": "Crying",
  "nsv:2.6": "Other negative vocalizations",
  "nsv:2.7": "Neutral / physiological sounds",
  "nsv:2.8": "Atypical vocalizations"
};
const englishRules = {
  "A1": "Word-supported speech excluding responses, echolalia and imitation; task speech is separate.",
  "A1a": "Candidate from vowel/CV-like transcription; not acoustically verified.",
  "A2": "Requests, attention bids, showing/sharing and other social initiations. Shares evidence with B15.",
  "A9": "Self-talk (Social 3.1).",
  "A4": "Social 3.7; adult matching supports but does not determine inclusion.",
  "A5": "A 2\u20135-word sequence in at least three utterances within this clip; unique utterances counted.",
  "B6": "A social initiation with laughter or another positive non-speech vocalization in the same utterance.",
  "B7": "First child vocal response within 0\u20133 seconds after an adult name mention, labeled Social 3.2; counted by episode.",
  "B10": "Requests in the vocal subset; explicit AAC-source utterances excluded.",
  "B15": "Same evidence as A2; do not add these counts together.",
  "B16b": "Attention bids or showing/sharing in caregiver\u2013child interaction; proxy candidate.",
  "E2": "Crying or other negative non-speech vocalization; each utterance counted once."
};
const state = {data:null, recording:null, child:null, taxonomy:'symptoms', code:null, event:null, media:null, frame:0, pendingSeek:null, liveSignature:''};
const timed = event => Number.isFinite(event.start) && Number.isFinite(event.end) && event.start >= 0 && event.end > event.start;
const inRange = (event, time) => timed(event) && event.start <= time && time < event.end;
const labelCount = value => value == null ? '—' : String(value);
const timeText = (seconds, precise = false) => {
  if (!Number.isFinite(seconds)) return '—';
  const units = precise ? Math.round(Math.max(0,seconds)*100) : Math.floor(Math.max(0,seconds)), scale = precise ? 100 : 1;
  const minutes = Math.floor(units / (60*scale)), remainder = units % (60*scale);
  return `${String(minutes).padStart(2,'0')}:${precise ? (remainder/100).toFixed(2).padStart(5,'0') : String(remainder).padStart(2,'0')}`;
};
const definitions = () => state.data.taxonomies[state.taxonomy].map(d => ({...d,label:englishLabels[d.code] || d.code,rule:englishRules[d.code] || `${englishLabels[d.code] || d.code}; each annotated utterance is counted once.`}));
const definitionForCode = code => definitions().find(x => x.code === code);
const definition = () => definitionForCode(state.code);
const isDemo = () => Boolean(state.data?.meta?.demo);
const availableRecordings = () => isDemo() ? state.data.recordings : state.data.recordings.filter(r => r.child === state.child.id);
const selectedEvents = () => (state.recording?.events || []).filter(e => e.codes[state.taxonomy].includes(state.code)).sort((a,b) => (timed(a) ? a.start : Infinity) - (timed(b) ? b.start : Infinity) || a.id.localeCompare(b.id));
const duration = () => Number.isFinite(state.media?.duration) ? state.media.duration : state.recording?.duration || 0;
const prettyCode = code => code.startsWith('social:') ? `Social ${code.slice(7)}` : code.startsWith('nsv:') ? `NSV ${code.slice(4)}` : code;
const playbackStart = event => {
  if (!$('preroll').checked) return event.start;
  const trigger = state.taxonomy === 'symptoms' && state.code === 'B7' && Number.isFinite(event.provenance?.trigger_start) ? event.provenance.trigger_start : event.start;
  return Math.max(0,trigger-1);
};

function error(message) { $('globalError').textContent = message; $('globalError').hidden = !message; }
function startupError(message) {
  $('startupStatus').textContent = message;
  $('startupStatus').hidden = false;
  $('startupStatus').setAttribute('role','alert');
}
async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) { let detail; try { detail = await response.json(); } catch {} throw new Error(detail?.error || `Request failed (${response.status})`); }
  return response.json();
}

function renderChildren() {
  $('childSelect').innerHTML = state.data.children.map(c => `<option value="${esc(c.id)}">Child ${esc(c.id)}</option>`).join('');
  $('childSelect').disabled = !state.data.children.length;
}

function selectChild(id, recordingId) {
  const child = state.data.children.find(c => c.id === id);
  const files = isDemo() ? state.data.recordings : state.data.recordings.filter(r => r.child === id);
  if (!child || !files.length) return;
  state.child = child;
  $('childSelect').value = id;
  $('recordingSelect').innerHTML = files.map(r => `<option value="${esc(r.id)}">${esc(r.id)}${r.demo_label ? ` · ${esc(r.demo_label)}` : r.annotated ? '' : ' · Unannotated'}</option>`).join('');
  $('recordingSelect').disabled = false;
  $('nextRecording').disabled = files.length < 2;
  const initial = files.find(r => r.id === recordingId) || files.find(r => r.child === id && r.annotated) || files[0];
  selectRecording(initial.id);
}

function selectRecording(id) {
  const r = availableRecordings().find(r => r.id === id);
  if (!r) return;
  cancelAnimationFrame(state.frame);
  const video = $('video');
  video.pause(); video.removeAttribute('src'); video.load();
  state.recording = r;
  state.child = state.data.children.find(c => c.id === r.child);
  $('childSelect').value = r.child;
  state.event = null; state.pendingSeek = Number.isFinite(r.demo_start) ? {target:r.demo_start,play:false} : null; state.liveSignature = '';
  $('recordingSelect').value = id;
  $('recordingTitle').textContent = r.demo_label || id;
  error('');
  state.media = video; video.hidden = false; $('mediaFallback').hidden = true;
  video.src = r.video_url || `./media/video/${encodeURIComponent(id)}`;
  $('mediaBadge').textContent = r.annotated ? 'Video' : 'Unannotated';
  video.playbackRate = Number($('speed').value); video.muted = false;
  for (const name of ['playPause','back5','forward5','speed']) $(name).disabled = false;
  if (r.demo_focus?.[state.taxonomy]) state.code = r.demo_focus[state.taxonomy];
  if (!state.code || !definitions().some(d => d.code === state.code)) state.code = definitions().find(d => r.counts[state.taxonomy][d.code] > 0)?.code || definitions()[0]?.code;
  renderCards(); renderTimeline(); renderEvidence(); updateTime(0);
  const url = new URL(location.href); url.searchParams.set('child',state.child.id); url.searchParams.set('recording',r.id); url.searchParams.set('view',state.taxonomy); history.replaceState(null,'',url);
}

function renderCards() {
  $('symptomCards').dataset.activeOrder = '';
  $('symptomCards').innerHTML = definitions().map((d,i) => {
    const count = state.recording.counts[state.taxonomy][d.code];
    const accent = '#16766d', tint = '#eaf7f3';
    return `<button class="symptom-card${state.code === d.code ? ' selected' : ''}" data-code="${esc(d.code)}" data-index="${i}" aria-pressed="${state.code === d.code}" style="--accent:${accent};--tint:${tint}" title="${esc(d.rule)}"><span class="card-content"><span class="card-label">${esc(d.label)}${d.candidate ? '<span class="candidate">Candidate</span>' : ''}</span><span class="card-meta"><span class="card-code">${esc(prettyCode(d.code))}</span></span></span><span class="card-total" title="${count == null ? 'Not annotated' : 'Occurrences in this clip'}"><strong>${labelCount(count)}</strong></span></button>`;
  }).join('');
  $('symptomCards').scrollTop = 0;
  $('symptomCards').querySelectorAll('button').forEach(button => button.addEventListener('click', () => selectCode(button.dataset.code)));
}

function selectCode(code) {
  state.code = code; state.event = null;
  $('symptomCards').querySelectorAll('button').forEach(b => { const selected = b.dataset.code === code; b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',String(selected)); });
  $('timeline').querySelectorAll('.timeline-row').forEach(row => row.classList.toggle('selected',row.dataset.code === code));
  renderEvidence();
}

function renderTimeline() {
  const seconds = duration(), defs = definitions();
  const visible = defs.filter(d => state.recording.events.some(e => timed(e) && e.codes[state.taxonomy].includes(d.code)));
  $('timelineCount').textContent = `(${visible.length})`;
  $('timelineEnd').textContent = timeText(seconds);
  $('timeline').innerHTML = visible.length && seconds ? visible.map(d => {
    const events = state.recording.events.filter(e => timed(e) && e.codes[state.taxonomy].includes(d.code));
    const accent = palette[defs.indexOf(d) % palette.length][0];
    return `<div class="timeline-row${state.code === d.code ? ' selected' : ''}" data-code="${esc(d.code)}"><button class="timeline-label" title="${esc(d.label)}">${esc(prettyCode(d.code))} · ${esc(d.label)}</button><div class="track">${events.map(e => `<button class="timeline-event" data-event="${esc(e.id)}" aria-label="${esc(d.label)}, ${timeText(e.start,true)} to ${timeText(e.end,true)}" title="${esc(d.label)} · ${timeText(e.start,true)}–${timeText(e.end,true)}" style="left:${100*e.start/seconds}%;width:${100*(e.end-e.start)/seconds}%;--accent:${accent}"></button>`).join('')}<span class="playhead"></span></div></div>`;
  }).join('') : '<div class="timeline-empty">No timed annotations in this clip.</div>';
  $('timeline').querySelectorAll('.timeline-row').forEach(row => {
    row.querySelector('.timeline-label').addEventListener('click', () => selectCode(row.dataset.code));
    row.querySelectorAll('.timeline-event').forEach(b => b.addEventListener('click', () => { selectCode(row.dataset.code); selectEvent(b.dataset.event,true); }));
  });
}

function renderEvidence() {
  const d = definition(), events = selectedEvents();
  if (!d) { $('events').replaceChildren(); $('prevEvent').disabled = true; $('nextEvent').disabled = true; return; }
  $('evidenceTitle').textContent = `${prettyCode(d.code)} · ${d.label}`;
  $('prerollLabel').textContent = state.taxonomy === 'symptoms' && state.code === 'B7' ? 'Include name mention' : 'Include context';
  const missing = events.filter(e => !timed(e)).length;
  const count = state.recording.counts[state.taxonomy][d.code];
  $('eventSummary').textContent = count == null ? 'Unannotated' : `${count} in this clip${missing ? ` · ${missing} untimed` : ''}`;
  $('events').innerHTML = events.length ? events.map((e,i) => `<button class="event-row${state.event?.id === e.id ? ' selected' : ''}" data-event="${esc(e.id)}"><span class="event-index">${String(i+1).padStart(2,'0')}</span><span class="event-time">${timed(e) ? `${timeText(e.start,true)}–${timeText(e.end,true)}` : 'Untimed'}</span><span class="event-text">${esc(e.text || '(No transcript)')}</span></button>`).join('') : `<div class="empty-state">${count == null ? 'This clip is not annotated.' : 'No occurrences in this clip.'}</div>`;
  $('events').querySelectorAll('button').forEach(b => b.addEventListener('click', () => selectEvent(b.dataset.event,true)));
  $('prevEvent').disabled = !events.length; $('nextEvent').disabled = !events.length;
}

function selectEvent(id, jump = false) {
  state.event = selectedEvents().find(e => e.id === id);
  if (!state.event) return;
  renderEvidence();
  if (jump && timed(state.event) && state.media) seek(playbackStart(state.event),true);
}

function orderCards(time, activeCodes) {
  const container = $('symptomCards'), latest = new Map();
  if (state.media) for (const event of state.recording.events) {
    if (!timed(event) || event.start > time) continue;
    for (const code of event.codes[state.taxonomy]) latest.set(code,Math.max(latest.get(code) ?? -1,event.start));
  }
  const cards = [...container.children].sort((a,b) =>
    Number(activeCodes.has(b.dataset.code)) - Number(activeCodes.has(a.dataset.code)) ||
    (latest.get(b.dataset.code) ?? -1) - (latest.get(a.dataset.code) ?? -1) ||
    Number(a.dataset.index) - Number(b.dataset.index));
  const focused = container.contains(document.activeElement) ? document.activeElement : null;
  cards.forEach((card,index) => { if (container.children[index] !== card) container.insertBefore(card,container.children[index]); });
  if (focused && document.activeElement !== focused) focused.focus({preventScroll:true});
  const activeOrder = cards.filter(card => activeCodes.has(card.dataset.code)).map(card => `${card.dataset.code}:${latest.get(card.dataset.code)}`).join('|');
  if (activeOrder && activeOrder !== container.dataset.activeOrder) container.scrollTop = 0;
  container.dataset.activeOrder = activeOrder;
}

function updateTime(time = state.media?.currentTime || 0) {
  if (!state.recording) return;
  $('clock').textContent = `${timeText(time,true)} / ${timeText(duration())}`;
  $('playPause').textContent = state.media && !state.media.paused ? 'Ⅱ Pause' : '▶ Play';
  const activeEvents = state.media ? state.recording.events.filter(e => inRange(e,time)) : [], activeCodes = new Set(activeEvents.flatMap(e => e.codes[state.taxonomy]));
  $('symptomCards').querySelectorAll('.symptom-card').forEach(card => {
    const active = activeCodes.has(card.dataset.code); card.classList.toggle('active',active);
    const d = definitionForCode(card.dataset.code), count = state.recording.counts[state.taxonomy][card.dataset.code];
    const label = `${d.label}${d.candidate ? ', candidate' : ''}, ${count == null ? 'not annotated' : `${count} in this clip`}, ${active ? 'active now' : 'inactive'}`;
    if (card.getAttribute('aria-label') !== label) card.setAttribute('aria-label',label);
  });
  orderCards(time,activeCodes);
  const activeIds = new Set(activeEvents.map(e => e.id));
  $('timeline').querySelectorAll('.timeline-event').forEach(b => b.classList.toggle('active',activeIds.has(b.dataset.event)));
  const position = duration() ? Math.max(0,Math.min(100,100*time/duration())) : 0;
  $('timeline').querySelectorAll('.playhead').forEach(p => p.style.left = `${position}%`);
  const signature = `${state.taxonomy}:${[...activeIds].join(',')}`;
  if (signature !== state.liveSignature) {
    state.liveSignature = signature;
    $('liveText').textContent = !state.media ? 'Video unavailable' : activeCodes.size ? definitions().filter(d => activeCodes.has(d.code)).map(d => d.label).join(' · ') : state.recording.annotated ? 'No active annotations' : 'Unannotated clip';
    $('activeCount').textContent = String(activeCodes.size);
    $('liveDot').classList.toggle('on',activeCodes.size > 0);
    const texts = [...new Set(activeEvents.filter(e => e.text).map(e => e.text))];
    $('transcript').textContent = texts.join(' / ') || '—';
  }
}

function animationLoop() {
  updateTime();
  if (state.media && !state.media.paused) state.frame = requestAnimationFrame(animationLoop);
}

function seek(time, play = false) {
  if (!state.media) return;
  const target = Math.max(0,Math.min(time,duration() || time));
  if (state.media.readyState < 1) { state.pendingSeek = {target,play}; return; }
  state.pendingSeek = null; state.media.currentTime = target; updateTime(target);
  if (play) safePlay();
}
function safePlay() {
  if (!state.media) return;
  const media = state.media;
  media.play().catch(e => { if (media === state.media && e.name !== 'AbortError') error(`Playback failed: ${e.message}. Try the video play button.`); });
}
function togglePlay() { if (state.media) { state.media.paused ? safePlay() : state.media.pause(); } }
function adjacentEvent(direction) {
  const events = selectedEvents(); if (!events.length) return;
  const index = events.findIndex(e => e.id === state.event?.id);
  const next = index < 0 ? (direction > 0 ? 0 : events.length-1) : Math.max(0,Math.min(events.length-1,index+direction));
  selectEvent(events[next].id,true);
  $('events').querySelector('.selected')?.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function switchTaxonomy(taxonomy) {
  if (!state.recording || state.taxonomy === taxonomy || !state.data.taxonomies[taxonomy]) return;
  state.taxonomy = taxonomy; state.event = null; state.code = state.recording.demo_focus?.[taxonomy] || definitions().find(d => state.recording.counts[taxonomy][d.code] > 0)?.code || definitions()[0]?.code;
  document.querySelectorAll('[data-taxonomy]').forEach(b => { b.classList.toggle('selected',b.dataset.taxonomy === taxonomy); b.setAttribute('aria-pressed',String(b.dataset.taxonomy === taxonomy)); });
  state.liveSignature = ''; renderCards(); renderTimeline(); renderEvidence(); updateTime();
  const url = new URL(location.href); url.searchParams.set('view',taxonomy); history.replaceState(null,'',url);
}

for (const media of [$('video')]) {
  media.addEventListener('loadedmetadata', () => {
    if (media !== state.media) return;
    renderTimeline(); updateTime();
    if (state.pendingSeek) { const {target,play} = state.pendingSeek; seek(target,play); }
  });
  media.addEventListener('loadeddata', () => {
    if (media !== state.media) return;
    if (media === $('video') && media.videoWidth === 0) error('Video decoding failed. Refresh after a compatible video copy is available.');
  });
  for (const name of ['timeupdate','seeked','seeking','pause','ended']) media.addEventListener(name, () => { if (media === state.media) updateTime(); });
  media.addEventListener('play', () => { if (media === state.media) { cancelAnimationFrame(state.frame); animationLoop(); } });
  media.addEventListener('ratechange', () => { if (media === state.media) $('speed').value = String(media.playbackRate); });
  media.addEventListener('error', () => { if (media === state.media && media.getAttribute('src')) error('Video could not be loaded. Try another clip or refresh.'); });
}
$('childSelect').addEventListener('change',e => selectChild(e.target.value));
$('recordingSelect').addEventListener('change',e => selectRecording(e.target.value));
$('nextRecording').addEventListener('click',() => { if (!state.recording) return; const files = availableRecordings(), index = files.findIndex(r => r.id === state.recording.id); selectRecording(files[(index+1)%files.length].id); });
$('playPause').addEventListener('click',togglePlay);
$('back5').addEventListener('click',() => seek((state.media?.currentTime || 0)-5));
$('forward5').addEventListener('click',() => seek((state.media?.currentTime || 0)+5));
$('speed').addEventListener('change',e => { if (state.media) state.media.playbackRate = Number(e.target.value); });
$('prevEvent').addEventListener('click',() => adjacentEvent(-1));
$('nextEvent').addEventListener('click',() => adjacentEvent(1));
document.querySelectorAll('[data-taxonomy]').forEach(b => b.addEventListener('click',() => switchTaxonomy(b.dataset.taxonomy)));
document.addEventListener('keydown',e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,select,button,a,video')) return;
  if ([' ','ArrowLeft','ArrowRight','[',']'].includes(e.key)) e.preventDefault();
  if (e.key === ' ') togglePlay();
  if (e.key === 'ArrowLeft') seek((state.media?.currentTime || 0)-5);
  if (e.key === 'ArrowRight') seek((state.media?.currentTime || 0)+5);
  if (e.key === '[') adjacentEvent(-1);
  if (e.key === ']') adjacentEvent(1);
});


async function init() {
  for (const name of ['nextRecording','playPause','back5','forward5','speed','prevEvent','nextEvent']) $(name).disabled = true;
  if (!['http:','https:'].includes(location.protocol)) {
    startupError('Open the HTTP/HTTPS review link, not this HTML file.');
    return;
  }
  try {
    const catalog = await api(document.documentElement.dataset.catalog || './api/catalog');
    const recordings = catalog.recordings.filter(r => r.video_available);
    const childIds = new Set(recordings.map(r => r.child));
    state.data = {...catalog,recordings,children:catalog.children.filter(c => childIds.has(c.id))};
    const query = new URLSearchParams(location.search);
    if (query.get('view') === 'behaviors') state.taxonomy = 'behaviors';
    document.querySelectorAll('[data-taxonomy]').forEach(b => { const selected = b.dataset.taxonomy === state.taxonomy; b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',String(selected)); });
    renderChildren();
    if (!state.data.children.length) {
      $('childSelect').innerHTML = '<option>No videos</option>';
      $('recordingSelect').innerHTML = '<option>No videos</option>';
      $('recordingSelect').disabled = true;
      $('video').hidden = true; $('mediaFallback').hidden = false;
      $('fallbackTitle').textContent = 'No videos available'; $('fallbackText').textContent = '';
      $('liveText').textContent = 'No videos available'; $('mediaBadge').textContent = 'No videos';
    } else {
      const requested = state.data.children.find(c => c.id === query.get('child'));
      const first = requested || state.data.children.find(c => recordings.some(r => r.child === c.id && r.annotated)) || state.data.children[0];
      selectChild(first.id,query.get('recording'));
    }
    if (document.querySelector('link[rel="stylesheet"]').sheet?.cssRules.length) $('startupStatus').hidden = true;
    else startupError('Styles could not load. Refresh the review link.');
  } catch(e) { startupError(`Could not load the review service: ${e.message}. Check the connection and refresh.`); }
}

init();
})();
