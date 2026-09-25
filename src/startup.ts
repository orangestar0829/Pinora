// A synchronous, disposable appearance hint; authoritative settings live in extension storage.
try { const theme = localStorage.getItem('pinora.theme'); document.documentElement.dataset.theme = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; } catch { /* Storage can be disabled. */ }
