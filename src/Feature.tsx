import { useEffect, useState } from "react";
import {
  ConfettiLayer,
  useConfetti,
  useDraft,
  useFairRng,
  useFlashOnChange,
  useNamedPeer,
  usePerPeerValue,
  usePhase,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Phase = "lobby" | "meld" | "reveal" | "won";

const INITIAL_CATEGORY = "fruit";

export function Feature({ room, config }: Props) {
  if (!room)
    return (
      <div className="meld-screen">
        <h1>mind meld</h1>
        <p>Connecting…</p>
      </div>
    );
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const fair = useFairRng(room, "meld-salts");
  const ph = usePhase<Phase>(room, "phase", "lobby");
  const submissions = usePerPeerValue<string>(room, "submissions", "");
  const wins = usePerPeerValue<number>(room, "wins", 0);
  const draft = useDraft<string>(`${config.storagePrefix}:word`, "");
  const { burst } = useConfetti();
  const flash = useFlashOnChange(ph.phase);

  const state = room.doc.getMap<string | number>("state");
  const [, bump] = useState(0);
  useEffect(() => {
    const cb = () => bump((n) => n + 1);
    state.observe(cb);
    return () => state.unobserve(cb);
  }, [state]);
  const category = (state.get("category") as string) ?? INITIAL_CATEGORY;
  const round = (state.get("round") as number) ?? 0;
  const pairA = state.get("pairA") as string | undefined;
  const pairB = state.get("pairB") as string | undefined;
  const inPair = room.peerId === pairA || room.peerId === pairB;
  const mySub = submissions.valueOf(room.peerId) ?? "";
  const aWord = pairA ? (submissions.valueOf(pairA) ?? "") : "";
  const bWord = pairB ? (submissions.valueOf(pairB) ?? "") : "";
  const subMap = room.doc.getMap<string>("submissions");

  const start = () => {
    const namesMap = room.doc.getMap<string>("__mesh_names");
    const present = new Set<string>([room.peerId]);
    namesMap.forEach((_, k) => present.add(k));
    const sh = fair.shuffle(Array.from(present));
    room.doc.transact(() => {
      state.set("category", INITIAL_CATEGORY);
      state.set("round", 1);
      state.set("pairA", sh[0] ?? room.peerId);
      state.set("pairB", sh[1] ?? sh[0] ?? room.peerId);
      submissions.entries.forEach(([p]) => subMap.delete(p));
    });
    ph.transition("meld");
  };

  const submit = () => {
    const w = draft.value.trim();
    if (!w || !inPair || mySub) return;
    submissions.setMy(w);
    draft.setValue("");
  };

  useEffect(() => {
    if (ph.phase !== "meld" || !pairA || !pairB) return;
    if (submissions.valueOf(pairA) && submissions.valueOf(pairB))
      ph.transition("reveal", { from: "meld" });
  }, [ph, submissions, pairA, pairB]);

  const matched =
    ph.phase === "reveal" &&
    !!aWord &&
    !!bWord &&
    aWord.toLowerCase().trim() === bWord.toLowerCase().trim();

  useEffect(() => {
    if (ph.phase !== "reveal") return;
    if (matched) {
      if (room.peerId === pairA) {
        const wm = room.doc.getMap<number>("wins");
        if (pairA) wm.set(pairA, (wins.valueOf(pairA) ?? 0) + 1);
        if (pairB) wm.set(pairB, (wins.valueOf(pairB) ?? 0) + 1);
      }
      burst({ origin: "top", count: 80, hueRange: [40, 80] });
      const t = setTimeout(() => ph.transition("won", { from: "reveal" }), 800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (room.peerId !== pairA) return;
      room.doc.transact(() => {
        state.set("category", `${aWord}+${bWord}`);
        state.set("round", round + 1);
        [pairA, pairB].forEach((p) => p && subMap.delete(p));
      });
      ph.transition("meld", { from: "reveal" });
    }, 2000);
    return () => clearTimeout(t);
  }, [ph.phase, matched, aWord, bWord, pairA, pairB, room, state, round, wins, burst, ph, subMap]);

  const trimmed = name.trim();
  const partnerId = room.peerId === pairA ? pairB : pairA;
  const partnerName = partnerId ? (nameOf(partnerId) ?? partnerId.slice(0, 6)) : "";
  const nm = (p?: string) => (p ? (nameOf(p) ?? p.slice(0, 6)) : "?");
  const aName = nm(pairA),
    bName = nm(pairB);

  return (
    <div className={`meld-screen${flash ? " meld-flash" : ""}`}>
      <ConfettiLayer />
      <h1>mind meld 🧠</h1>
      <input
        className="meld-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        aria-label="your name"
        maxLength={32}
      />

      {ph.phase === "lobby" && (
        <button className="meld-start" aria-label="start" onClick={start} disabled={!trimmed}>
          start
        </button>
      )}

      {ph.phase !== "lobby" && (
        <>
          <p className="meld-pair">
            {inPair ? `you're paired with ${partnerName}` : `spectating: ${aName} & ${bName}`}
          </p>
          <div className="meld-category">
            <span className="meld-cat-label">round {round} · category</span>
            <strong>{category}</strong>
          </div>
        </>
      )}

      {ph.phase === "meld" && inPair && !mySub && (
        <div className="meld-input-row">
          <input
            className="meld-input"
            value={draft.value}
            onChange={(e) => draft.setValue(e.target.value)}
            placeholder="your word"
            aria-label="your word"
            maxLength={32}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button className="meld-submit" aria-label="submit word" onClick={submit}>
            submit word
          </button>
        </div>
      )}
      {ph.phase === "meld" && inPair && mySub && (
        <p className="meld-waiting">waiting for {partnerName}…</p>
      )}

      {(ph.phase === "reveal" || ph.phase === "won") && (
        <div className="meld-reveal">
          <div className="meld-word">
            <span>{aName}</span>
            <strong>{aWord || "…"}</strong>
          </div>
          <div className="meld-word">
            <span>{bName}</span>
            <strong>{bWord || "…"}</strong>
          </div>
          {matched || ph.phase === "won" ? (
            <p className="meld-result meld-meld">MELD! 🧠</p>
          ) : (
            <p className="meld-result">
              new category: {aWord}+{bWord}
            </p>
          )}
        </div>
      )}

      <div className="meld-scores">
        {wins.entries.map(([pid, w]) => (
          <span key={pid} className="meld-chip">
            {nameOf(pid) ?? pid.slice(0, 6)}: {w}
          </span>
        ))}
      </div>
    </div>
  );
}
