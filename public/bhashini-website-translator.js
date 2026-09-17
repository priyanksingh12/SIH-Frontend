/**
 * Bhashini Full-Website Translator (Govt. of India ULCA / Dhruva NMT Engine)
 * Translates entire React SPA DOM content dynamically into 24 Indian languages.
 * Synchronous in-flight translation & MutationObserver to eliminate flash of English.
 * Bulletproof dynamic switching: preserves original English text, allowing seamless
 * switching between any languages without manual page reloads.
 */

(function () {
  "use strict";

  const currentScript = document.currentScript;
  const scriptApi = currentScript ? currentScript.getAttribute("data-api") : null;
  const API_BASE =
    scriptApi ||
    window.__API_BASE__ ||
    (window.location.hostname === "localhost" && window.location.port === "5000"
      ? "http://localhost:5000"
      : "https://sih-otuc.onrender.com");

  const SUPPORTED_LANGS = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
    { code: "mr", name: "Marathi", nativeName: "मराठी" },
    { code: "bn", name: "Bengali", nativeName: "বাংলা" },
    { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
    { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
    { code: "te", name: "Telugu", nativeName: "తెలుగు" },
    { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
    { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
    { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
    { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
    { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
    { code: "ur", name: "Urdu", nativeName: "اردو" },
    { code: "sa", name: "Sanskrit", nativeName: "संस्कृत" },
    { code: "ne", name: "Nepali", nativeName: "नेपाली" },
    { code: "si", name: "Sinhala", nativeName: "සිංහල" },
    { code: "ks", name: "Kashmiri", nativeName: "کٲشُر" },
    { code: "doi", name: "Dogri", nativeName: "डोगरी" },
    { code: "mai", name: "Maithili", nativeName: "मैथिली" },
    { code: "kok", name: "Konkani", nativeName: "कोंकणी" },
    { code: "mni", name: "Manipuri", nativeName: "মেইতেই" },
    { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
    { code: "sd", name: "Sindhi", nativeName: "سنڌي" },
    { code: "bo", name: "Bodo", nativeName: "बर" },
  ];

  // WeakMap for DOM nodes -> original English string
  const originalTextMap = new WeakMap();

  // Reverse map: translatedText -> originalEnglishText (to recover English if node has no record)
  const reverseCache = new Map();

  // In-memory translation cache: `${lang}:${englishText}` -> translatedText
  const translationCache = new Map();

  // Load persisted cache synchronously from localStorage on startup
  try {
    const savedCache = localStorage.getItem("bhashini_tr_cache");
    if (savedCache) {
      const parsed = JSON.parse(savedCache);
      Object.entries(parsed).forEach(([k, v]) => {
        translationCache.set(k, v);
        const colonIdx = k.indexOf(":");
        if (colonIdx !== -1) {
          const origEnglish = k.slice(colonIdx + 1);
          reverseCache.set(v, origEnglish);
        }
      });
    }
  } catch (e) {
    // Ignore cache load errors
  }

  function saveCacheToStorage() {
    try {
      const obj = {};
      let count = 0;
      for (const [k, v] of translationCache.entries()) {
        obj[k] = v;
        if (++count > 2500) break;
      }
      localStorage.setItem("bhashini_tr_cache", JSON.stringify(obj));
    } catch (e) {
      // Ignore
    }
  }

  let currentLanguage =
    localStorage.getItem("bhashini_website_lang") ||
    localStorage.getItem("SwasthyaSahay-dashboard-lang") ||
    "en";
  let isTranslating = false;
  let isApplyingTranslation = false;
  let observer = null;
  let pendingNodes = new Set();
  let debounceTimeout = null;

  const IGNORED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "CODE",
    "PRE",
    "SVG",
    "PATH",
    "INPUT",
  ]);

  function finishInitialTranslation() {
    document.documentElement.classList.remove("bhashini-translating");
  }

  /**
   * Retrieves original English text for a node safely.
   */
  function getOriginalEnglish(node) {
    if (!node) return null;
    if (node.__bhashini_orig_en__ !== undefined) {
      return node.__bhashini_orig_en__;
    }
    if (originalTextMap.has(node)) {
      return originalTextMap.get(node);
    }
    const currentVal = node.nodeValue?.trim();
    if (currentVal && reverseCache.has(currentVal)) {
      const orig = reverseCache.get(currentVal);
      setOriginalEnglish(node, orig);
      return orig;
    }
    return null;
  }

  /**
   * Sets the original English text for a node.
   * CRITICAL: Never overwrites an already-recorded English original!
   */
  function setOriginalEnglish(node, text) {
    if (!node || text === undefined || text === null) return;
    if (node.__bhashini_orig_en__ !== undefined) return;
    if (originalTextMap.has(node)) return;

    node.__bhashini_orig_en__ = text;
    originalTextMap.set(node, text);
  }

  /**
   * Checks if a node should be translated
   */
  function isValidTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    if (IGNORED_TAGS.has(parent.tagName)) return false;
    if (parent.closest("[data-no-translate]")) return false;
    if (parent.closest(".bhashini-widget-container")) return false;

    const text = node.nodeValue?.trim();
    if (!text || text.length < 2) return false;
    // Pure numbers / symbols
    if (/^[\d\s\-_.,!?:;#@%&*()+=/\\|<>\[\]{}'"]+$/.test(text)) return false;

    return true;
  }

  /**
   * Synchronously translates a single text node from the cache if available.
   * Returns true if translated immediately, false otherwise.
   */
  function translateNodeSync(node, targetLang) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    if (!isValidTextNode(node)) return false;

    if (targetLang === "en") {
      const orig = getOriginalEnglish(node);
      if (orig && node.nodeValue !== orig) {
        isApplyingTranslation = true;
        node.nodeValue = orig;
        isApplyingTranslation = false;
        return true;
      }
      return false;
    }

    let orig = getOriginalEnglish(node);
    if (!orig) {
      orig = node.nodeValue;
      setOriginalEnglish(node, orig);
    }

    const trimmedOrig = orig.trim();
    const cacheKey = `${targetLang}:${trimmedOrig}`;

    if (translationCache.has(cacheKey)) {
      const cached = translationCache.get(cacheKey);
      if (cached && node.nodeValue !== cached) {
        const leadingSpace = orig.match(/^\s*/)?.[0] || "";
        const trailingSpace = orig.match(/\s*$/)?.[0] || "";
        isApplyingTranslation = true;
        node.nodeValue = leadingSpace + cached + trailingSpace;
        isApplyingTranslation = false;
        return true;
      }
    }
    return false;
  }

  /**
   * Recursively collect valid text nodes under a root
   */
  function getTextNodes(root = document.body) {
    const textNodes = [];
    if (!root) return textNodes;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isValidTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    let currNode;
    while ((currNode = walker.nextNode())) {
      textNodes.push(currNode);
    }
    return textNodes;
  }

  /**
   * Process and translate a batch of text nodes
   */
  async function processNodes(nodes, targetLang) {
    if (!nodes || nodes.length === 0 || targetLang === "en") return;

    const uncachedTexts = [];
    const nodesToTranslate = [];

    nodes.forEach((node) => {
      if (!node.isConnected) return;

      // Try synchronous translation first
      if (translateNodeSync(node, targetLang)) {
        return;
      }

      let orig = getOriginalEnglish(node);
      if (!orig) {
        orig = node.nodeValue;
        setOriginalEnglish(node, orig);
      }
      const trimmedOrig = orig.trim();
      if (!trimmedOrig) return;

      nodesToTranslate.push(node);
      if (!uncachedTexts.includes(trimmedOrig)) {
        uncachedTexts.push(trimmedOrig);
      }
    });

    if (uncachedTexts.length === 0) return;

    // Send in chunks of 25 to Bhashini translate-batch
    const CHUNK_SIZE = 25;
    for (let i = 0; i < uncachedTexts.length; i += CHUNK_SIZE) {
      const chunk = uncachedTexts.slice(i, i + CHUNK_SIZE);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`${API_BASE}/api/bhashini/translate-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: chunk,
            sourceLanguage: "en",
            targetLanguage: targetLang,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const translatedArray = data.translatedTexts || data.translations || [];

          chunk.forEach((origText, idx) => {
            const trans = translatedArray[idx] || origText;
            translationCache.set(`${targetLang}:${origText}`, trans);
            reverseCache.set(trans, origText);
          });

          // Apply to live nodes
          isApplyingTranslation = true;
          nodesToTranslate.forEach((node) => {
            if (!node.isConnected) return;
            const orig = getOriginalEnglish(node);
            if (!orig) return;
            const trimmedOrig = orig.trim();
            const translated = translationCache.get(`${targetLang}:${trimmedOrig}`);
            if (translated) {
              const leadingSpace = orig.match(/^\s*/)?.[0] || "";
              const trailingSpace = orig.match(/\s*$/)?.[0] || "";
              node.nodeValue = leadingSpace + translated + trailingSpace;
            }
          });
          isApplyingTranslation = false;

          saveCacheToStorage();
        }
      } catch (err) {
        console.warn("[Bhashini Website Translator] Batch request error:", err.message);
      }
    }
  }

  /**
   * Translates current page DOM into target language immediately from cache,
   * then batches and processes any uncached nodes.
   */
  async function translateCurrentPage(targetLang) {
    targetLang = (
      targetLang ||
      currentLanguage ||
      localStorage.getItem("bhashini_website_lang") ||
      localStorage.getItem("SwasthyaSahay-dashboard-lang") ||
      "en"
    ).toLowerCase();

    currentLanguage = targetLang;

    if (targetLang === "en") {
      restoreOriginalText();
      finishInitialTranslation();
      return;
    }

    const allNodes = getTextNodes(document.body || document.documentElement);
    if (!allNodes || allNodes.length === 0) return;

    // Step 1: Immediately apply cached translations synchronously (0ms delay)
    isApplyingTranslation = true;
    allNodes.forEach((node) => {
      let orig = getOriginalEnglish(node);
      if (!orig) {
        orig = node.nodeValue;
        setOriginalEnglish(node, orig);
      }
      translateNodeSync(node, targetLang);
    });
    isApplyingTranslation = false;
    finishInitialTranslation();

    // Step 2: Translate any remaining uncached strings in the background
    await processNodes(allNodes, targetLang);
  }

  /**
   * Translates the whole website into the specified target language dynamically
   */
  async function setLanguage(targetLang) {
    if (!targetLang) return;
    targetLang = targetLang.toLowerCase();

    currentLanguage = targetLang;
    localStorage.setItem("bhashini_website_lang", targetLang);
    localStorage.setItem("SwasthyaSahay-dashboard-lang", targetLang);
    window.dispatchEvent(new CustomEvent("bhashini:languageChange", { detail: { language: targetLang } }));

    // If switching back to English, restore all original text immediately
    if (targetLang === "en") {
      restoreOriginalText();
      finishInitialTranslation();
      return;
    }

    isTranslating = true;
    try {
      await translateCurrentPage(targetLang);
    } finally {
      isTranslating = false;
      finishInitialTranslation();
    }

    startObserver();
  }

  /**
   * Restores original text on all modified nodes
   */
  function restoreOriginalText() {
    isApplyingTranslation = true;
    try {
      const allNodes = getTextNodes(document.body || document.documentElement);
      allNodes.forEach((node) => {
        const original = getOriginalEnglish(node);
        if (original && node.nodeValue !== original) {
          node.nodeValue = original;
        }
      });
    } finally {
      isApplyingTranslation = false;
    }
  }

  /**
   * MutationObserver tracks DOM changes from React routing and state updates.
   * Intercepts added nodes and translates cached strings SYNCHRONOUSLY before paint!
   */
  function startObserver() {
    if (observer) return;

    const target = document.documentElement || document.body;
    if (!target) return;

    observer = new MutationObserver((mutations) => {
      if (isApplyingTranslation) return;
      if (currentLanguage === "en") return;

      let hasUncachedNodes = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((added) => {
            if (added.nodeType === Node.TEXT_NODE) {
              if (isValidTextNode(added)) {
                setOriginalEnglish(added, added.nodeValue);
                const translated = translateNodeSync(added, currentLanguage);
                if (!translated) {
                  pendingNodes.add(added);
                  hasUncachedNodes = true;
                }
              }
            } else if (added.nodeType === Node.ELEMENT_NODE) {
              if (added.closest && added.closest("[data-no-translate]")) return;
              const nodes = getTextNodes(added);
              nodes.forEach((n) => {
                setOriginalEnglish(n, n.nodeValue);
                const translated = translateNodeSync(n, currentLanguage);
                if (!translated) {
                  pendingNodes.add(n);
                  hasUncachedNodes = true;
                }
              });
            }
          });
        } else if (mutation.type === "characterData") {
          const targetNode = mutation.target;
          if (isValidTextNode(targetNode)) {
            const knownOrig = getOriginalEnglish(targetNode);
            if (!knownOrig && !reverseCache.has(targetNode.nodeValue)) {
              setOriginalEnglish(targetNode, targetNode.nodeValue);
              const translated = translateNodeSync(targetNode, currentLanguage);
              if (!translated) {
                pendingNodes.add(targetNode);
                hasUncachedNodes = true;
              }
            }
          }
        }
      });

      if (hasUncachedNodes) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          const batch = Array.from(pendingNodes);
          pendingNodes.clear();
          processNodes(batch, currentLanguage);
        }, 80);
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Patches HTML5 History API to automatically trigger translation whenever
   * the URL changes in a single page application (SPA).
   */
  function patchHistory() {
    if (window.__bhashini_history_patched__) return;
    window.__bhashini_history_patched__ = true;

    const originalPushState = history.pushState;
    history.pushState = function () {
      const ret = originalPushState.apply(this, arguments);
      window.dispatchEvent(new Event("bhashini:locationchange"));
      return ret;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function () {
      const ret = originalReplaceState.apply(this, arguments);
      window.dispatchEvent(new Event("bhashini:locationchange"));
      return ret;
    };

    window.addEventListener("popstate", () => {
      window.dispatchEvent(new Event("bhashini:locationchange"));
    });

    function handleNavigation() {
      const lang =
        currentLanguage ||
        localStorage.getItem("bhashini_website_lang") ||
        localStorage.getItem("SwasthyaSahay-dashboard-lang") ||
        "en";
      if (lang && lang !== "en") {
        translateCurrentPage(lang);
        setTimeout(() => translateCurrentPage(lang), 150);
        setTimeout(() => translateCurrentPage(lang), 500);
        setTimeout(() => translateCurrentPage(lang), 1200);
      }
    }

    window.addEventListener("bhashini:locationchange", handleNavigation);
  }

  // Expose Global Public API
  window.BhashiniTranslator = {
    setLanguage,
    translateCurrentPage,
    restoreOriginalText,
    getLanguage: () => currentLanguage,
    getSupportedLanguages: () => SUPPORTED_LANGS,
  };

  // Immediate startup logic:
  patchHistory();
  startObserver();

  function onDomReady() {
    startObserver();
    if (currentLanguage && currentLanguage !== "en") {
      const allNodes = getTextNodes(document.body || document.documentElement);
      allNodes.forEach((n) => {
        setOriginalEnglish(n, n.nodeValue);
        translateNodeSync(n, currentLanguage);
      });
      finishInitialTranslation();

      processNodes(allNodes, currentLanguage).then(finishInitialTranslation);
    } else {
      finishInitialTranslation();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady);
    window.addEventListener("load", finishInitialTranslation);
  } else {
    onDomReady();
  }
})();
