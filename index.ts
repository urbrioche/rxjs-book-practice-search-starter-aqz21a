// 畫面上的 DOM 物件操作程式
import * as domUtils from './dom-utils';

// 存取 API 資料的程式碼
import * as dataUtils from './data-utils';
import { BehaviorSubject, combineLatest, fromEvent, merge, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  scan,
  share,
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

/* search by keyword 第一版

// keyword沒輸入 按search會出錯(getSearchResult)，事件監聽也會停止
// 即使重新key keyword，search button怎麼按都沒效
// 用cathError解決 (書裡沒示範這個情境)
// https://www.learnrxjs.io/learn-rxjs/operators/error_handling/catch
// error and continue listening
const searchByKeyword$ = search$.pipe(
  switchMap(() => keywordForSearch$),
  // 加上filter，避免空值查詢出錯
  filter((keyword) => !!keyword),
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

*/

// search by keyword 第二版 (排序/分頁)
const searchByKeyword$ = search$.pipe(
  switchMap(() => keywordForSearch$),
  filter((keyword) => !!keyword)
);

// 建立BehaviorSubject，預設使用stars進行降冪排序
const sortBy$ = new BehaviorSubject({
  sort: 'stars',
  order: 'desc',
});

const changeSort = (sortField: string) => {
  if (sortField === sortBy$.value.sort) {
    sortBy$.next({
      sort: sortField,
      order: sortBy$.value.order === 'asc' ? 'desc' : 'asc',
    });
  } else {
    sortBy$.next({
      sort: sortField,
      order: 'desc',
    });
  }
};

fromEvent(document.querySelector('#sort-stars'), 'click').subscribe(() => {
  changeSort('stars');
});

fromEvent(document.querySelector('#sort-forks'), 'click').subscribe(() => {
  changeSort('forks');
});

const perPage$ = fromEvent(document.querySelector('#per-page'), 'change').pipe(
  map((event: Event) => {
    const input = event.target as HTMLSelectElement;
    return +input.value;
  })
);

const previousPage$ = fromEvent(
  document.querySelector('#previous-page'),
  'click'
).pipe(mapTo(-1));

const nextPage$ = fromEvent(document.querySelector('#next-page'), 'click').pipe(
  mapTo(1)
);

const page$ = merge(previousPage$, nextPage$).pipe(
  scan((currentPageIndex, value) => {
    const nextPage = currentPageIndex + value;
    return nextPage < 1 ? 1 : nextPage;
  }, 1)
);

const startSearch$ = combineLatest({
  keyword: searchByKeyword$,
  sort: sortBy$,
  page: page$.pipe(startWith(1)),
  perPage: perPage$.pipe(startWith(10)),
});

// block UI
startSearch$.subscribe(() => {
  domUtils.loading();
});

const searchResult$ = startSearch$.pipe(
  switchMap(({ keyword, sort, page, perPage }) => {
    return dataUtils
      .getSearchResult(keyword, sort.sort, sort.order, page, perPage)
      .pipe(
        map((result) => {
          console.log('看一下conosle，觀察按search後，這段是否進入兩次');
          return result;
        }),
        // 為顯示錯誤訊息做準備
        map((result) => ({
          success: true,
          message: null,
          data: result,
        })),
        // 錯誤處理放這裡才正確
        catchError((error) =>
          of({
            success: false,
            message: error.response.message,
            data: [],
          })
        )
      );
  }),
  // searchResult$有多次訂閱
  // 因此使用share避免重複請求資料
  share()
);

// searchResult$訂閱第一次 for display data
searchResult$
  /* 這段錯誤處理要搬到上面dataUtils.getSearchResult 才是正確的
  .pipe(
    // 處理搜尋事件的錯誤，以避免整個資料流從此中斷
    // 當發生錯誤時，回傳空白資料
    // 看似可行，但實際上不可行
    // 因為在這裡回傳空陣列，會使訂閱結束
    catchError(() => of([]))
  )
  */
  .subscribe((result) => {
    console.log('fillSearchResult');
    domUtils.fillSearchResult(result.data);
    // unblock UI
    domUtils.loaded();
  });

// searchResult$訂閱第二次 for alert
// 這次訂閱也會跑完整的資料流，也就是ajax的查詢也會再跑一次
// -> 要在上方searchResult定義資料流的地方加share()
searchResult$.pipe(filter((result) => !result.success)).subscribe((result) => {
  alert(result.message);
});

page$.subscribe((page) => {
  domUtils.updatePageNumber(page);
});

sortBy$.pipe(filter((sort) => sort.sort === 'starts')).subscribe((sort) => {
  domUtils.updateStarsSort(sort);
});

sortBy$.pipe(filter((sort) => sort.sort === 'forks')).subscribe((sort) => {
  domUtils.updateForksSort(sort);
});
