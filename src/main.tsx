import { render } from 'preact';
import { App } from './app';
import { requestPersist } from './db/store';
import './styles.css';

render(<App />, document.getElementById('app')!);
requestPersist();

// 오프라인 동작 (개발 서버에서는 등록하지 않음)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
