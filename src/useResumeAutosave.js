import { useEffect, useMemo, useRef, useState } from "react";
import { createResumeAutosave } from "./resume-autosave.mjs";

export function useResumeAutosave({ resumeId, ready, payload, request, notify }) {
  const [state, setState] = useState("loading");
  const callbacks = useRef({ request, notify });
  callbacks.current = { request, notify };
  const mounted = useRef(false);
  const writer = useMemo(() => createResumeAutosave({
    write: (snapshot) => {
      const body = JSON.stringify({ ...snapshot, summary: "自动保存简历修改" });
      return callbacks.current.request(`/api/resumes/${resumeId}`, {
        method: "PUT", body, keepalive: new Blob([body]).size < 60000,
      });
    },
    onState: (next) => { if (mounted.current) setState(next); },
    onError: (error) => callbacks.current.notify(`自动保存失败，请重试：${error.message}`),
  }), [resumeId]);
  const serialized = JSON.stringify(payload);

  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (event) => {
      if (!writer.dirty()) return;
      void writer.flush();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      void writer.flush();
    };
  }, [writer]);

  useEffect(() => { if (ready) writer.update(JSON.parse(serialized)); }, [writer, ready, serialized]);
  return { state, saveNow: writer.flush };
}
