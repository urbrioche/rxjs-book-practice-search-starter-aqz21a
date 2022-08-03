// 畫面上的 DOM 物件操作程式
import * as domUtils from './dom-utils';

// 存取 API 資料的程式碼
import * as dataUtils from './data-utils';
import { fromEvent } from 'rxjs';
import { debounceTime, map, switchMap } from 'rxjs/operators';

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
    debounceTime(700),
    switchMap((keyword) => dataUtils.getSuggestions(keyword))
  )
  .subscribe((suggestions) => {
    domUtils.fillAutoSuggestions(suggestions);
  });