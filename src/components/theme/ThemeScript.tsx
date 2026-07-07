import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)||(t!=='light'&&t!=='system');document.documentElement.setAttribute('data-theme',d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
