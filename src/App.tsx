import { useReducer, useEffect, useState, useCallback } from 'react';
import { getEndingData, EndingId } from './systems/EndingSystem';
import { getOpeningPage } from './systems/OpeningSystem';
import { gameReducer, createInitialState, replaySeason } from './systems/GameEngine';
import DATA from './data';
import { fill } from './utils/text';
import { newSeed } from './utils/rng';
import ScenePanel from './components/ScenePanel';
import LogDrawer from './components/ScenePanel/LogDrawer';
import StatusPanel from './components/StatusPanel';
import ChoicePanel from './components/ChoicePanel';
import NameInput from './components/common/NameInput';
import NameEntry from './components/common/NameEntry';
import EstateTaskList from './components/common/EstateTaskList';
import OpeningSequence from './components/OpeningSequence';
import TitleScreen from './components/TitleScreen';
import SaveMenu from './components/common/SaveMenu';
import Inventory from './components/common/Inventory';
import EndingGallery from './components/common/EndingGallery';
import CodexPanel from './components/common/CodexPanel';
import { recordCodex, currentUnlocks } from './systems/CodexSystem';
import {
  AUTO_SLOT, ManualSlot, SaveSummary,
  writeSlot, readSlot, clearSlot, readSlotSummary, listManualSlots,
  setPendingResume, takePendingResume,
} from './systems/SaveSystem';
import { getLocale, setLocale } from './data/locale';
import { readSeenEndings, recordEnding } from './systems/CollectionSystem';

const ui = DATA.ui;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState(newSeed()));

  // Where the player is in the shell, which is not part of the season and so is
  // not saved: a refresh puts them back at the title with the season intact.
  const [atTitle, setAtTitle] = useState(true);
  const [savesOpen, setSavesOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  // The entry a clicked name asked for; cleared when the codex closes, so the next plain
  // opening starts from the top again.
  const [codexFocus, setCodexFocus] = useState<string | undefined>(undefined);
  const closeCodex = () => { setCodexOpen(false); setCodexFocus(undefined); };
  const [autoSave, setAutoSave] = useState<SaveSummary | null>(() => readSlotSummary(AUTO_SLOT));
  const [manualSaves, setManualSaves] = useState<(SaveSummary | null)[]>(() => listManualSlots());
  const [seenEndings, setSeenEndings] = useState<EndingId[]>(() => readSeenEndings());

  const refreshManualSaves = useCallback(() => setManualSaves(listManualSlots()), []);

  // Opening a save in another language reloads the page to switch the UI first; the
  // slot it was opening is reopened here, now under its own language, so the season
  // never shows up with its chrome and its text in two different languages.
  useEffect(() => {
    const slot = takePendingResume();
    if (!slot) return;
    const saved = readSlot(slot);
    if (!saved) return;
    dispatch({ type: 'LOAD_STATE', state: saved });
    setAtTitle(false);
  }, []);

  // The gallery is a record of the browser, not of the season, so an ending goes in
  // the moment it is reached — including one reached by loading a finished save.
  useEffect(() => {
    if (!state.demoComplete || !state.endingId) return;
    recordEnding(state.endingId as EndingId);
    setSeenEndings(readSeenEndings());
  }, [state.demoComplete, state.endingId]);

  // The codex is a browser record like the gallery: whatever a run has unlocked is
  // written the moment it reaches an ending, so it carries into the next season even
  // if the 见闻 panel was never opened this time.
  useEffect(() => {
    if (!state.demoComplete || !state.endingId) return;
    recordCodex(currentUnlocks(state));
  }, [state.demoComplete, state.endingId]);

  // The autosave follows every change, including the ones inside an event: the
  // season should survive a closed tab at any point in it, not only at bedtime.
  useEffect(() => {
    if (atTitle) return;
    writeSlot(AUTO_SLOT, state);
  }, [state, atTitle]);

  // An event with nothing to decide gets a "继续" — either because it never had
  // choices, or because none of them apply to this playthrough.
  const isNarrativeOnly = state.activeEvent !== null && state.currentChoices.length === 0;

  // An event may ask for the signature before its choices become available.
  const pendingInput = state.activeEvent?.textInput && !state.playerName
    ? state.activeEvent.textInput
    : null;

  useEffect(() => {
    document.title = atTitle
      ? ui.app.documentTitle
      : fill(ui.app.documentTitleInSeason, { day: state.day });
  }, [state.day, atTitle]);

  const startNewSeason = () => {
    clearSlot(AUTO_SLOT);
    setAutoSave(null);
    dispatch({ type: 'RESET', seed: newSeed() });
    setAtTitle(false);
  };

  // A save's text is frozen in the language it was written in. When that is not the
  // language the game is in now, play the season again from its seed and recorded
  // actions: the same weather, the same draws, the same numbers, with the words in the
  // current language. A save that cannot be replayed (written before seasons were
  // recorded, or by an older build) falls back to the old way — switch the UI to the
  // save's language first (which reloads) and reopen the slot on the way back in;
  // openSlot returns false when it has handed off to that reload.
  const openSlot = (slot: string): boolean => {
    const summary = readSlotSummary(slot);
    if (!summary) return false;
    const saved = readSlot(slot);
    if (!saved) return false;
    let loaded = saved;
    if (summary.locale !== getLocale()) {
      const replayed = replaySeason(saved);
      if (!replayed) {
        setPendingResume(slot);
        setLocale(summary.locale);
        return false;
      }
      loaded = replayed;
    }
    dispatch({ type: 'LOAD_STATE', state: loaded });
    setAtTitle(false);
    return true;
  };

  const continueSeason = () => {
    openSlot(AUTO_SLOT);
  };

  const loadManual = (slot: ManualSlot) => {
    if (openSlot(slot)) setSavesOpen(false);
  };

  const saveManual = (slot: ManualSlot) => {
    writeSlot(slot, state);
    refreshManualSaves();
  };

  const deleteManual = (slot: ManualSlot) => {
    clearSlot(slot);
    refreshManualSaves();
  };

  // Back to the title, and the autosave goes with the season it belonged to —
  // otherwise 继续 would offer to continue an ending.
  const backToTitle = () => {
    clearSlot(AUTO_SLOT);
    setAutoSave(null);
    dispatch({ type: 'RESET', seed: newSeed() });
    setSavesOpen(false);
    setAtTitle(true);
  };

  // The other way back: leave a season unfinished. The autosave follows every change,
  // so it already holds this moment; write it once more to be sure, and 继续 on the
  // title picks the season up exactly here. Nothing is cleared.
  const leaveToTitle = () => {
    writeSlot(AUTO_SLOT, state);
    setAutoSave(readSlotSummary(AUTO_SLOT));
    setSavesOpen(false);
    setAtTitle(true);
  };

  if (atTitle) {
    return (
      <>
        <TitleScreen
          auto={autoSave}
          hasManualSaves={manualSaves.some(Boolean)}
          onNew={startNewSeason}
          onContinue={continueSeason}
          onOpenSaves={() => setSavesOpen(true)}
          onOpenGallery={() => setGalleryOpen(true)}
          onOpenCodex={() => setCodexOpen(true)}
        />
        {savesOpen && (
          <SaveMenu
            slots={manualSaves}
            canSave={false}
            onSave={saveManual}
            onLoad={loadManual}
            onDelete={deleteManual}
            onClose={() => setSavesOpen(false)}
          />
        )}
        {galleryOpen && (
          <EndingGallery seen={seenEndings} onClose={() => setGalleryOpen(false)} />
        )}
        {codexOpen && (
          <CodexPanel state={null} onClose={closeCodex} />
        )}
      </>
    );
  }

  const openingPage = state.openingPage === null ? null : getOpeningPage(state.openingPage);
  if (openingPage) {
    // Name first, then the documents (D6): until it is given, the only screen is
    // the signature. After that the letter renders already bearing it.
    if (!state.playerName) {
      return <NameEntry onSubmit={(name) => dispatch({ type: 'SET_PLAYER_NAME', name })} />;
    }
    return (
      <OpeningSequence
        page={openingPage}
        index={state.openingPage as number}
        playerName={state.playerName}
        onSign={(name) => dispatch({ type: 'SET_PLAYER_NAME', name })}
        onAdvance={() => dispatch({ type: 'ADVANCE_OPENING' })}
        onSkip={() => dispatch({ type: 'SKIP_OPENING' })}
      />
    );
  }

  // The choices now live inline under the prose (UI direction B). Whatever the
  // beat asks for — a season's-end farewell, a signature, a plain 继续, or the
  // day's own actions — is rendered in the same slot beneath the last paragraph.
  const choiceArea = state.demoComplete && state.endingId ? (
    <div className="flex flex-col items-start gap-3 py-1">
      <div>
        <p className="text-gold font-serif text-lg">{getEndingData(state.endingId as EndingId).title}</p>
        <p className="text-game-text text-sm mt-1">{getEndingData(state.endingId as EndingId).subtitle}</p>
      </div>
      {/* 4.g.v: the way back to Day 1 stays a whisper, not a banner. */}
      <button
        onClick={backToTitle}
        className="px-10 py-3 bg-gold-dim border border-gold text-bg font-serif text-base rounded-sm hover:bg-gold transition-all"
      >
        {ui.app.restart}
      </button>
    </div>
  ) : pendingInput ? (
    <NameInput
      spec={pendingInput}
      onSubmit={(name) => dispatch({ type: 'SET_PLAYER_NAME', name })}
    />
  ) : isNarrativeOnly ? (
    <button
      onClick={() => dispatch({ type: 'ADVANCE_DAY_EVENT' })}
      className="px-8 py-2.5 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
    >
      {ui.app.continue}
    </button>
  ) : state.pendingAdvance ? (
    // An evening action's outcome is on screen; the day turns only on the click.
    <button
      onClick={() => dispatch({ type: 'COMMIT_ADVANCE' })}
      className="px-8 py-2.5 border border-gold-dim text-cream font-serif text-sm rounded-sm hover:bg-bg-hover hover:border-gold transition-all"
    >
      {ui.app.continue}
    </button>
  ) : (
    <ChoicePanel
      choices={state.currentChoices}
      mode={state.activeEvent ? 'event' : 'daily'}
      onChoice={(id) => dispatch({ type: 'MAKE_CHOICE', choiceId: id })}
    />
  );

  return (
    <div className="h-screen bg-bg text-game-text flex flex-col overflow-hidden p-3">
      {/* The whole board is capped and centred: on a wide screen the reading column
          stays snug against the readouts instead of stranding a gap between them.
          Below lg the three columns stop being columns — they stack into one scroll
          (reading first, then the readouts, then the record), because a 375px phone
          cannot spare 256px to a fixed status rail and still leave a column to read in. */}
      <div className="flex flex-col lg:flex-row gap-3 w-full max-w-[78rem] mx-auto flex-1 min-h-0 overflow-y-auto lg:overflow-visible">
        {/* Left: the estate's business, and the record beneath it (B) — the log
            moved out from between the prose and the choices. Desktop only: below lg
            the tasks already return inside the 劳作 tab and the log stacks at the end. */}
        <div className="w-48 shrink-0 hidden lg:flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <EstateTaskList
              state={state}
              actionableIds={new Set(state.currentChoices.filter(c => !c.disabled).map(c => c.id))}
              marketChoice={state.currentChoices.find(c => c.id === 'go_to_market') ?? null}
              inEvent={state.activeEvent !== null}
              onTake={(id) => dispatch({ type: 'MAKE_CHOICE', choiceId: id })}
            />
          </div>
          <LogDrawer log={state.log} />
        </div>

        {/* Centre: the prose, with the choices inline beneath it. */}
        <div className="min-w-0 lg:flex-1">
          <ScenePanel
            state={state}
            onOpenSaves={() => { refreshManualSaves(); setSavesOpen(true); }}
            onOpenInventory={() => setInventoryOpen(true)}
            onOpenCodex={() => { recordCodex(currentUnlocks(state)); setCodexOpen(true); }}
          >
            <div key={`${state.day}-${state.phase}`} className="choices-enter">
              {choiceArea}
            </div>
          </ScenePanel>
        </div>

        {/* Right: the estate's readouts — a fixed rail at desktop, a full-width block
            under the reading when stacked. */}
        <div className="w-full lg:w-64 shrink-0">
          <StatusPanel
            state={state}
            onOpenCodex={(entryId) => { recordCodex(currentUnlocks(state)); setCodexFocus(entryId); setCodexOpen(true); }}
          />
        </div>

        {/* The record: it lives in the left column at desktop, but that column is gone
            when stacked, so it gets a home at the foot of the scroll on small screens. */}
        <div className="lg:hidden">
          <LogDrawer log={state.log} />
        </div>
      </div>

      {savesOpen && (
        <SaveMenu
          slots={manualSaves}
          canSave
          onSave={saveManual}
          onLoad={loadManual}
          onDelete={deleteManual}
          onLeave={state.demoComplete ? undefined : leaveToTitle}
          onClose={() => setSavesOpen(false)}
        />
      )}

      {inventoryOpen && (
        <Inventory state={state} onClose={() => setInventoryOpen(false)} />
      )}

      {codexOpen && (
        <CodexPanel state={state} focus={codexFocus} onClose={closeCodex} />
      )}
    </div>
  );
}
