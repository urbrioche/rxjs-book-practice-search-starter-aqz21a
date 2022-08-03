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
  shareReplay,
  switchMap,
  take,
} from 'rxjs/operators';

const keyword$ = fromEvent(document.querySelector('#keyword'), 'input').pipe(
  map((event) => (event.target as HTMLInputElement).value),
  // 加上shareReplay(1)是為了共享最後一次事件
  // 否則按search button不會去查詢
  // 要再去變動一下keyword，讓他產生資料流才會，才會真的去查詢
  // 步驟變成: click search button -> change keyword -> 不合邏輯
  shareReplay(1)
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

// search button
const search$ = fromEvent(document.querySelector('#search'), 'click');
// search$
//   .pipe(
//     switchMap(() => {
//       const input = document.querySelector('#keyword') as HTMLInputElement;
//       return dataUtils.getSearchResult(input.value);
//     })
//   )
//   .subscribe((result) => domUtils.fillSearchResult(result));

// 這邊加take(1)是為了讓keywords$資料流能結束
// 否則，你每打一次keyword，既會suggest也會search
const keywordForSearch$ = keyword$.pipe(take(1));

const searchByKeyword$ = search$.pipe(
  switchMap(() => keywordForSearch$),
  switchMap((keyword) => dataUtils.getSearchResult(keyword))
);

searchByKeyword$.subscribe((result) => {
  console.log('search');
  domUtils.fillSearchResult(result);
});
