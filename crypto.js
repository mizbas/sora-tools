// そらのツール箱：購入コードでツールを復号する仕組み（ブラウザ内で完結。サーバーには何も送りません）
(function (root) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const tob64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  const KEYS = "sora.keys.v1";

  function normalize(code) {
    return (code || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function getKeys() { try { return JSON.parse(localStorage.getItem(KEYS) || "{}"); } catch (e) { return {}; } }
  function setKey(id, k) { const all = getKeys(); all[id] = k; try { localStorage.setItem(KEYS, JSON.stringify(all)); } catch (e) {} }
  function hasKey(id) { return !!getKeys()[id]; }

  async function deriveKek(code, saltB64, iter) {
    const base = await crypto.subtle.importKey("raw", enc.encode(normalize(code)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(saltB64), iterations: iter, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }

  // code を全ツールに試し、開けたツールのidを返す
  async function unlockWithCode(code, site, toolFiles) {
    const kek = await deriveKek(code, site.salt, site.iter);
    const opened = [];
    for (const [id, file] of Object.entries(toolFiles)) {
      for (const w of file.wraps) {
        try {
          const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(w.iv) }, kek, b64(w.d));
          setKey(id, tob64(raw)); opened.push(id); break;
        } catch (e) { /* このコードでは開かない */ }
      }
    }
    return opened;
  }

  async function decryptTool(id, file) {
    const k = getKeys()[id];
    if (!k) throw new Error("locked");
    const key = await crypto.subtle.importKey("raw", b64(k), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(file.iv) }, key, b64(file.d));
    return dec.decode(plain);
  }

  root.SoraLock = { normalize, hasKey, getKeys, unlockWithCode, decryptTool };
})(window);
