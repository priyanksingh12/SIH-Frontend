/**
 * Bhashini Full-Website Translator (Govt. of India ULCA / Dhruva NMT Engine)
 * Translates entire React SPA DOM content dynamically into 24 Indian languages.
 * Synchronous in-flight translation & MutationObserver to eliminate flash of English.
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
    { code: "or", name: "Odia", nativeName: "ଓਡ଼ਿଆ" },
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

  // In-memory translation cache: `${lang}:${text}` -> translatedText
  const translationCache = new Map();

  // Load persisted cache synchronously from localStorage on startup
  try {
    const savedCache = localStorage.getItem("bhashini_tr_cache");
    if (savedCache) {
      const parsed = JSON.parse(savedCache);
      Object.entries(parsed).forEach(([k, v]) => translationCache.set(k, v));
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
    if (!node || node.nodeType !== Node.TEXT_NODE || targetLang === "en") return false;
    if (!isValidTextNode(node)) return false;

    if (!originalTextMap.has(node)) {
      originalTextMap.set(node, node.nodeValue);
    }

    const orig = (originalTextMap.get(node) || node.nodeValue).trim();
    const cacheKey = `${targetLang}:${orig}`;

    if (translationCache.has(cacheKey)) {
      const cached = translationCache.get(cacheKey);
      if (cached && node.nodeValue !== cached) {
        node.nodeValue = cached;
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

      const orig = (originalTextMap.get(node) || node.nodeValue).trim();
      nodesToTranslate.push(node);
      if (!uncachedTexts.includes(orig)) {
        uncachedTexts.push(orig);
      }
    });

    if (uncachedTexts.length === 0) return;

    // Send in chunks of 25 to Bhashini translate-batch
    const CHUNK_SIZE = 25;
    for (let i = 0; i < uncachedTexts.length; i += CHUNK_SIZE) {
      const chunk = uncachedTexts.slice(i, i + CHUNK_SIZE);
      try {
        const res = await fetch(`${API_BASE}/api/bhashini/translate-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: chunk,
            sourceLanguage: "en",
            targetLanguage: targetLang,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const translatedArray = data.translatedTexts || data.translations || [];

          chunk.forEach((origText, idx) => {
            const trans = translatedArray[idx] || origText;
            translationCache.set(`${targetLang}:${origText}`, trans);
          });

          // Apply to live nodes
          nodesToTranslate.forEach((node) => {
            if (!node.isConnected) return;
            const orig = (originalTextMap.get(node) || "").trim();
            const translated = translationCache.get(`${targetLang}:${orig}`);
            if (translated && node.nodeValue !== translated) {
              node.nodeValue = translated;
            }
          });

          saveCacheToStorage();
        }
      } catch (err) {
        console.warn("[Bhashini Website Translator] Batch request error:", err.message);
      }
    }
  }

  /**
   * Translates the whole website into the specified target language
   */
  async function setLanguage(targetLang) {
    if (!targetLang) return;
    targetLang = targetLang.toLowerCase();

    // If switching to English, restore all original text
    if (targetLang === "en") {
      currentLanguage = "en";
      localStorage.setItem("bhashini_website_lang", "en");
      localStorage.setItem("SwasthyaSahay-dashboard-lang", "en");
      restoreOriginalText();
      finishInitialTranslation();
      window.dispatchEvent(new CustomEvent("bhashini:languageChange", { detail: { language: "en" } }));
      return;
    }

    currentLanguage = targetLang;
    localStorage.setItem("bhashini_website_lang", targetLang);
    localStorage.setItem("SwasthyaSahay-dashboard-lang", targetLang);
    window.dispatchEvent(new CustomEvent("bhashini:languageChange", { detail: { language: targetLang } }));

    isTranslating = true;
    try {
      const allNodes = getTextNodes(document.body || document.documentElement);
      // Synchronously translate everything from cache first
      allNodes.forEach((node) => translateNodeSync(node, targetLang));
      finishInitialTranslation();

      // Translate remaining uncached strings
      await processNodes(allNodes, targetLang);
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
    const allNodes = getTextNodes(document.body || document.documentElement);
    allNodes.forEach((node) => {
      if (originalTextMap.has(node)) {
        const original = originalTextMap.get(node);
        if (original && node.nodeValue !== original) {
          node.nodeValue = original;
        }
      }
    });
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
      if (currentLanguage === "en" || isTranslating) return;

      let hasUncachedNodes = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((added) => {
            if (added.nodeType === Node.TEXT_NODE) {
              // Try instant synchronous replacement from cache
              const translated = translateNodeSync(added, currentLanguage);
              if (!translated && isValidTextNode(added)) {
                pendingNodes.add(added);
                hasUncachedNodes = true;
              }
            } else if (added.nodeType === Node.ELEMENT_NODE) {
              const nodes = getTextNodes(added);
              nodes.forEach((n) => {
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
            const orig = originalTextMap.get(targetNode);
            if (!orig || orig !== targetNode.nodeValue) {
              originalTextMap.set(targetNode, targetNode.nodeValue);
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

  // Expose Global Public API
  window.BhashiniTranslator = {
    setLanguage,
    restoreOriginalText,
    getLanguage: () => currentLanguage,
    getSupportedLanguages: () => SUPPORTED_LANGS,
  };

  // Immediate startup logic:
  // Start observing right away on documentElement so early React mounts are caught!
  startObserver();

  function onDomReady() {
    startObserver();
    if (currentLanguage && currentLanguage !== "en") {
      const allNodes = getTextNodes(document.body || document.documentElement);
      // Synchronously translate from cache
      allNodes.forEach((n) => translateNodeSync(n, currentLanguage));
      finishInitialTranslation();

      // Trigger background translation for any remaining text
      processNodes(allNodes, currentLanguage).then(finishInitialTranslation);
    } else {
      finishInitialTranslation();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady);
    // Also attach on window load just in case
    window.addEventListener("load", finishInitialTranslation);
  } else {
    onDomReady();
  }
})();
