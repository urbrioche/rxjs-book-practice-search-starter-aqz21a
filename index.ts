// 畫面上的 DOM 物件操作程式
import * as domUtils from './dom-utils';

// 存取 API 資料的程式碼
import * as dataUtils from './data-utils';
import { fromEvent } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
} from 'rxjs/operators';

const keyword$ = fromEvent(document.querySelector('#keyword'), 'input').pipe(
  map((event) => (event.target as HTMLInputElement).value)
);

// avoid nested subscribe
// keyword$.subscribe((keyword) => {
//   dataUtils.getSuggestions(keyword).subscribe((suggestions) => {
//     domUtils.fillAutoSuggestions(suggestions);
//   });
// });

// 使用switchMap解決nested subscribe
keyword$
  .pipe(
    // 避免一有事件就查詢
    debounceTime(700),
    // 避免重複查詢
    distinctUntilChanged(),
    // 避免內容太少查不出精準內容
    filter((keyword) => keyword.length >= 3),
    switchMap((keyword) => dataUtils.getSuggestions(keyword))
  )
  .subscribe((suggestions) => {
    domUtils.fillAutoSuggestions(suggestions);
  });
