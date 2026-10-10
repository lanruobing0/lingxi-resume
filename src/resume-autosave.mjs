// One writer per editor: newer edits wait for the previous request to finish.
export function createResumeAutosave({ write, onState, onError, delay = 800 }) {
  let latest, saved, timer, running;
  const dirty = () => latest !== undefined && latest !== saved;
  const flush = () => {
    clearTimeout(timer);
    if (running) return running;
    if (!dirty()) return Promise.resolve(true);
    running = (async () => {
      while (dirty()) {
        const snapshot = latest;
        onState("saving");
        try {
          await write(JSON.parse(snapshot));
          saved = snapshot;
        } catch (error) {
          onState("error");
          onError(error);
          return false;
        }
      }
      onState("saved");
      return true;
    })().finally(() => { running = undefined; });
    return running;
  };
  return {
    update(payload) {
      latest = JSON.stringify(payload);
      if (saved === undefined) { saved = latest; onState("saved"); return; }
      clearTimeout(timer);
      if (running) return;
      onState(dirty() ? "pending" : "saved");
      if (dirty()) timer = setTimeout(flush, delay);
    },
    flush,
    dirty,
  };
}
