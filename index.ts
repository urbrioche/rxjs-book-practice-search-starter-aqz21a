// 畫面上的 DOM 物件操作程式
import * as domUtils from './dom-utils';

// 存取 API 資料的程式碼
import * as dataUtils from './data-utils';
import { fromEvent, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  take,
} from 'rxjs/operators';

const keyword$ = fromEvent(document.querySelector('#keyword'), 'input').pipe(
  map((event) => (event.target as HTMLInputElement).value),
  // 讓資料流有初始值，解決先按search再輸入keyword的資料流問題
  startWith(''),
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

// const searchByKeyword$ = search$.pipe(
//   switchMap(() => keywordForSearch$),
//   switchMap((keyword) => dataUtils.getSearchResult(keyword))
// );

// keyword沒輸入 按search會出錯(getSearchResult)，事件監聽也會停止
// 即使重新key keyword，search button怎麼按都沒效
// 用cathError解決 (書裡沒示範這個情境)
// https://www.learnrxjs.io/learn-rxjs/operators/error_handling/catch
// error and continue listening
const searchByKeyword$ = search$.pipe(
  switchMap(() => keywordForSearch$),
  switchMap((keyword) =>
    dataUtils.getSearchResult(keyword).pipe(catchError((err) => of([])))
  )
);

// error but stop listening
// const searchByKeyword$ = search$.pipe(
//   switchMap(() => keywordForSearch$),
//   switchMap((keyword) =>
//     dataUtils.getSearchResult(keyword)
//   ),
//   catchError((err) => {
//     console.log(err, 'err');
//     return of([]);
//   })
// );

searchByKeyword$.subscribe((result) => {
  console.log(result);
  console.log('search');
  domUtils.fillSearchResult(result);
});

// 目前版本的問題
// 一進來就按search
// 因為keyword根本還沒發生資料流
// shareReplay(1)及take(1) 沒作用
// keywordForSearch$ 不會立刻結束
// 此時user意識到操作錯誤
// 下一個動作在keyword輸入要查詢的關鍵字，但還沒按Search
// 這是會發現search是有被執行的 (下方表格有資料)
