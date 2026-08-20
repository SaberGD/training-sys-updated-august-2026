
// Gracefully override the global window.fetch to provide a setter.
// This prevents fatal TypeError: Cannot set property fetch of #<Window> which has only a getter 
// in sandboxed iframe environments where window.fetch is a read-only native getter.
try {
  let currentFetch = window.fetch;
  if (currentFetch) {
    Object.defineProperty(window, 'fetch', {
      get() {
        return currentFetch;
      },
      set(newFetch) {
        currentFetch = newFetch;
      },
      configurable: true,
      enumerable: true
    });
  }
} catch (e) {
  console.warn("Could not redefine window.fetch with a setter:", e);
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global interceptor to convert Arabic/Persian numbers to English numbers automatically
const arabicToEnglishMap: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
};

function convertArabicToEnglish(str: string): string {
  return str.replace(/[٠-٩۰-۹]/g, (match) => arabicToEnglishMap[match] || match);
}

if (typeof window !== 'undefined') {
  window.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) {
      return;
    }
    const originalValue = target.value;
    if (!originalValue) return;

    const convertedValue = convertArabicToEnglish(originalValue);
    if (convertedValue !== originalValue) {
      let start: number | null = null;
      let end: number | null = null;
      try {
        start = target.selectionStart;
        end = target.selectionEnd;
      } catch (err) {
        // selectionStart/selectionEnd not supported on this input type
      }

      const prototype = target.tagName === 'INPUT' 
        ? window.HTMLInputElement.prototype 
        : window.HTMLTextAreaElement.prototype;
      
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(target, convertedValue);
        // Dispatch event to let React know
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        target.value = convertedValue;
      }

      if (start !== null && end !== null) {
        try {
          target.setSelectionRange(start, end);
        } catch (err) {
          // setSelectionRange not supported on this input type
        }
      }
    }
  }, true);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
