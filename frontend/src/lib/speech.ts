// Cross-platform Text-To-Speech helper for Regional Indian Languages

const LANG_VOICE_MAP: Record<string, string> = {
  hi: "hi-IN",
  te: "te-IN",
  mr: "mr-IN",
  en: "en-IN",
};

export function speakText(
  text: string,
  lang: string = "hi",
  onEnd?: () => void,
  onError?: () => void
): boolean {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      const targetLang = LANG_VOICE_MAP[lang] || "hi-IN";
      utterance.lang = targetLang;
      utterance.rate = 0.9; // Slightly slower for clear rural comprehension
      utterance.pitch = 1.0;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith(lang.toLowerCase())
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = () => {
        onEnd?.();
      };

      utterance.onerror = () => {
        onError?.();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      onEnd?.();
      return false;
    }
  }

  // Mobile / non-browser fallback
  setTimeout(() => {
    onEnd?.();
  }, 1500);
  return false;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // safe
    }
  }
}
