document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('note-text');
  const wordCount = document.getElementById('word-count');
  const charCount = document.getElementById('char-count');
  const resetBtn = document.getElementById('clear-btn');
  const themeToggle = document.getElementById('theme-toggle');

  const MAX = 200;
  const WARN_AT = 180;
  const DRAFT_KEY = 'note-draft';
  const THEME_KEY = 'theme';

  // Counters ----------
  function updateCounters() {
    const text = textarea.value;
    const chars = text.length;
    const trimmed = text.trim();
    const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;

    charCount.textContent = `${chars} / ${MAX} characters`;
    wordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;

    // second argument of toggle: true = add the class, false = remove it
    charCount.classList.toggle('warning', chars > WARN_AT);
    charCount.classList.toggle('over', chars > MAX);
  }

  // Draft saving ----------
  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, textarea.value);
  }

  function loadDraft() {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved !== null) {
      textarea.value = saved;
    }
    updateCounters();
  }

  // Clear ----------
  function clearNote() {
    textarea.value = '';
    localStorage.removeItem(DRAFT_KEY);
    updateCounters();
    textarea.focus();
  }

  // Theme ----------
  function applyTheme(isDark) {
    document.body.classList.toggle('dark', isDark);
    // the label shows what the button will switch TO
    themeToggle.textContent = isDark ? 'Light mode' : 'Dark mode';
  }

  function loadTheme() {
    applyTheme(localStorage.getItem(THEME_KEY) === 'dark');
  }

  // Events ----------
  textarea.addEventListener('input', () => {
    updateCounters();
    saveDraft();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearNote();
  });

  resetBtn.addEventListener('click', clearNote);

  themeToggle.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark');
    applyTheme(isDark);
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  });

  // Init ----------
  loadDraft();
  loadTheme();
});